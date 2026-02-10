import React, { useState, useRef, useEffect } from 'react';
import { Event, Citizen, ScanEntry, User, UserRole } from '../types';
import { MOCK_CITIZEN_DB } from '../constants';
import { Download, X, CheckCircle, AlertCircle, MessageSquare, Database, Loader2, Trash2, User as UserIcon, Clock, Upload, RefreshCw } from 'lucide-react';

const formatEventName = (name: string) => {
  return name
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ');
};

// --- Provided CSV Parsing Logic ---

interface WorkerRecord {
  tc: string;
  fullName: string;
  expiryDate: string;
  status: 'active' | 'inactive' | 'expired';
}

// SECURITY: Retrieve IDs from environment variables.
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || '1SU3otVPg8MVP77yfNdrIZ3Qlw5k7VoFg';
const GID = import.meta.env.VITE_SHEET_GID || '893430437';
const CSV_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

async function fetchSheetData(): Promise<WorkerRecord[]> {
  try {
    // Add timestamp to bypass any intermediate caching
    const timestamp = new Date().getTime();
    const urlWithCacheBuster = `${CSV_EXPORT_URL}&t=${timestamp}`;

    console.log('Fetching database from Google Sheets (Direct)...');
    const response = await fetch(urlWithCacheBuster, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch Google Sheet CSV:', response.statusText);
      return [];
    }

    const text = await response.text();

    // Debug: Log the first 50 chars to see encoding/headers
    console.log('CSV Preview (First 50 chars):', text.trim().substring(0, 50));

    // Check for HTML response (usually means the sheet is not published to web/public)
    if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('<html')) {
      console.warn('Cannot parse CSV: Received HTML. Ensure the sheet is "Published to Web".');
      return [];
    }

    return parseCSV(text);
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}

function parseCSV(csvText: string): WorkerRecord[] {
  const rows = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const records: WorkerRecord[] = [];

  if (rows.length === 0) return [];

  // Find the header row dynamically
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowUpper = rows[i].toUpperCase();
    if ((rowUpper.includes('T.C.') || rowUpper.includes('TC')) && (rowUpper.includes('AD'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.warn('Could not find header row in CSV. Available rows preview:', rows.slice(0, 3));
    return [];
  }

  const headers = parseCSVRow(rows[headerRowIndex]).map(h => h.trim());
  console.log('Detected Headers:', headers);

  // Map columns based on headers
  const tcIndex = headers.findIndex(h => {
    const s = h.toUpperCase();
    return s.includes('T.C.') || s.includes('TC') || s === 'KİMLİK NO';
  });

  // Try combined "ADI SOYADI" first
  let fullNameIndex = headers.findIndex(h => h.toUpperCase().includes('ADI') && h.toUpperCase().includes('SOYADI'));

  // Then try separate "ADI" and "SOYADI"
  const firstNameIndex = headers.findIndex(h => h.toUpperCase() === 'ADI' || h.toUpperCase() === 'AD');
  const lastNameIndex = headers.findIndex(h => h.toUpperCase() === 'SOYADI' || h.toUpperCase() === 'SOYAD');

  const dateIndex = headers.findIndex(h => {
    const s = h.toUpperCase();
    return s.includes('GEÇERLİLİK') || s.includes('TARİH') || s.includes('EXPIRY');
  });

  console.log(`Column Mapping: TC Index: ${tcIndex}, FullName Index: ${fullNameIndex}, FirstName Index: ${firstNameIndex}, LastName Index: ${lastNameIndex}, Date Index: ${dateIndex}`);

  if (tcIndex === -1) {
    console.warn('Could not find TC column in headers:', headers);
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = parseCSVRow(rows[i]);

    if (row.length <= tcIndex) continue;

    const tc = row[tcIndex]?.trim().replace(/\D/g, '');

    // Basic TC validation (11 digits)
    if (!tc || tc.length !== 11) continue;

    let fullName = '';
    if (fullNameIndex > -1) {
      fullName = row[fullNameIndex]?.trim();
    } else if (firstNameIndex > -1) {
      const fn = row[firstNameIndex]?.trim() || '';
      const ln = lastNameIndex > -1 ? row[lastNameIndex]?.trim() || '' : '';
      fullName = `${fn} ${ln}`.trim();
    }

    const expiryDateStr = dateIndex > -1 ? row[dateIndex]?.trim() : '';

    // Calculate Status based on Date
    let status: 'active' | 'inactive' | 'expired' = 'inactive';
    const expiryDateObj = parseDate(expiryDateStr);

    if (expiryDateObj) {
      if (expiryDateObj >= today) {
        status = 'active';
      } else {
        status = 'expired';
      }
    } else {
      status = 'inactive';
    }

    records.push({
      tc,
      fullName,
      expiryDate: expiryDateStr || '-',
      status
    });
  }

  console.log(`Successfully parsed ${records.length} records from Google Sheets.`);
  return records;
}

// Helper to parse DD.MM.YYYY
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('.');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const y = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime()) && date.getDate() === d) {
      return date;
    }
  }
  // Try YYYY-MM-DD fallback
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
}

// Simple CSV row parser that handles quoted values containing commas
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}


// --- Component ---

interface AuditScreenProps {
  event: Event;
  allEvents: Event[]; // For cross checking
  currentUser: User;
  onExit: () => void;
  onFinish: (duration: string) => void;
  onScan: (entry: ScanEntry) => void; // This calls Firestore write
  onBulkScan: (entries: ScanEntry[]) => void;
  onDelete: (entry: ScanEntry) => void;
  scannedList: ScanEntry[];
  allScannedEntries: Record<string, ScanEntry[]>; // For cross checking
  onCheckConflict: (tc: string, eventId: string) => Promise<string | null>;
  onDatabaseUpdate: (freshDb: Citizen[]) => void;
  isDarkMode: boolean;
  activeCompanyName?: string | null;
}

const AuditScreen: React.FC<AuditScreenProps> = ({
  event,
  allEvents,
  currentUser,
  onExit,
  onFinish,
  onScan,
  onBulkScan,
  onDelete,
  scannedList,
  allScannedEntries,
  onCheckConflict,
  onDatabaseUpdate,
  isDarkMode,
  activeCompanyName
}) => {
  const [tcInput, setTcInput] = useState('');
  const [lastScanResult, setLastScanResult] = useState<{ status: 'SUCCESS' | 'ERROR' | 'WARNING' | 'IDLE', message: string, citizen?: Citizen }>({ status: 'IDLE', message: '' });
  const [database, setDatabase] = useState<Citizen[]>(MOCK_CITIZEN_DB);
  const [dbStatus, setDbStatus] = useState<'LOADING' | 'READY' | 'ERROR'>('ERROR');
  const [startTime] = useState(Date.now());
  const [showSummary, setShowSummary] = useState(false);
  const [durationStr, setDurationStr] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch from Google Sheets - SMART CACHE (2 Hours)
  const loadData = async () => {
    const CACHE_KEY = 'geds_worker_db_v2';
    const TIME_KEY = 'geds_worker_db_time_v2';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

    try {
      // Check Cache First
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(TIME_KEY);
      if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < CACHE_DURATION)) {
        console.log('📦 Using local cache for worker list');
        const onlineCitizens = JSON.parse(cachedData) as Citizen[];
        setDatabase([...onlineCitizens, ...MOCK_CITIZEN_DB]);
        setDbStatus('READY');
        onDatabaseUpdate(onlineCitizens);
        return;
      }

      console.log('🌐 Cache expired or missing. Fetching fresh database from Google Sheets...');
      setDbStatus('LOADING');
      const workerRecords = await fetchSheetData();
      console.log(`Fetched ${workerRecords.length} worker records from Google Sheets`);

      if (workerRecords.length > 0) {
        console.log('Sample Record from Sheet:', workerRecords[0]);
        const onlineCitizens = workerRecords.map(r => ({
          tc: r.tc,
          name: r.fullName,
          surname: '',
          validityDate: r.expiryDate
        }));

        setDatabase([...onlineCitizens, ...MOCK_CITIZEN_DB]);
        setDbStatus('READY');
        onDatabaseUpdate(onlineCitizens);

        // Save to cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(onlineCitizens));
          localStorage.setItem(TIME_KEY, Date.now().toString());
        } catch (e) {
          console.warn("Worker cache error:", e);
        }
      } else {
        console.warn("Worker fetch returned empty. Using local mock data.");
        setDatabase(MOCK_CITIZEN_DB);
        setDbStatus('ERROR');
      }
    } catch (e) {
      console.error("DB Load error", e);
      setDatabase(MOCK_CITIZEN_DB);
      setDbStatus('ERROR');
    }
  };

  useEffect(() => {
    loadData();
  }, []);




  const performScan = async (tc: string) => {
    const trimmedTC = tc.trim();

    if (!trimmedTC) return;

    if (trimmedTC.length !== 11) {
      setLastScanResult({ status: 'ERROR', message: 'TC Kimlik Numarası 11 haneli olmalıdır.' });
      return;
    }

    if (scannedList.length >= event.targetCount) {
      setLastScanResult({ status: 'ERROR', message: 'Toplam hedef kişi sayısına ulaşıldı. Daha fazla kayıt yapılamaz. Denetlemeyi bitir' });
      setTcInput('');
      return;
    }

    // Check existing in list
    const alreadyScanned = scannedList.find(s => s.citizen.tc === trimmedTC);
    if (alreadyScanned) {
      setLastScanResult({ status: 'ERROR', message: 'MÜKERRER KAYIT! Bu kişi zaten listeye eklendi.' });
      setTcInput('');
      return;
    }

    // Cross-Event Validation (Optimized Async)
    const conflictError = await onCheckConflict(trimmedTC, event.id);

    if (conflictError) {
      setLastScanResult({ status: 'ERROR', message: conflictError, citizen: { tc: trimmedTC, name: 'Çakışma', surname: 'Tespit Edildi', validityDate: '-' } });
      setTcInput('');
      return;
    }

    // DB Lookup
    let citizen = database.find(c => c.tc === trimmedTC);
    let message = '';
    let status: 'SUCCESS' | 'WARNING' = 'SUCCESS';

    if (citizen) {
      message = 'Kayıt başarı ile gerçekleştirildi';
      status = 'SUCCESS';
    } else {
      citizen = {
        tc: trimmedTC,
        name: 'Veri Tabanında',
        surname: 'Bulunamadı',
        validityDate: '-'
      };
      message = 'Kimlik kartının geçerlilik süresini kontrol et';
      status = 'WARNING';
    }

    // Check if we hit the total target with this scan
    if (scannedList.length + 1 >= event.targetCount) {
      message = "🏁 TOPLAM HEDEF SAYIYA ULAŞILDI! Lütfen 'Denetimi Bitir' butonuna basın.";
    }

    const newEntry: ScanEntry = {
      id: Date.now().toString(),
      eventId: event.id,
      citizen: citizen,
      timestamp: new Date().toLocaleTimeString(),
      recordedBy: currentUser.username,
      companyName: activeCompanyName || undefined
    };

    // Fire and forget (Optimistic UI handled by Firestore listener in App.tsx)
    onScan(newEntry);
    setLastScanResult({ status: status, message: message, citizen });
    setTcInput('');
    inputRef.current?.focus();
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    performScan(tcInput);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setTcInput(val);

    if (val.length === 11) {
      performScan(val);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const XLSX = await import('xlsx');
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const newEntries: ScanEntry[] = [];
      let successCount = 0;
      let failCount = 0;
      let errorMsg = '';

      const currentTimestamp = new Date().toLocaleTimeString();
      let currentScannedCount = scannedList.length;

      // Flatten data to get just TCs from first available column
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.length === 0) continue;

        const tcVal = row.find(cell => cell !== undefined && cell !== null && cell !== '');
        if (!tcVal) continue;

        const tc = String(tcVal).trim().replace(/\D/g, '');

        if (tc.length !== 11) continue;

        if (currentScannedCount + newEntries.length >= event.targetCount) {
          errorMsg = 'Hedef limite ulaşıldı.';
          break;
        }

        // 1. Duplicate in List
        if (scannedList.find(s => s.citizen.tc === tc)) {
          failCount++;
          continue;
        }

        // 2. Duplicate in Batch
        if (newEntries.find(s => s.citizen.tc === tc)) {
          continue;
        }

        // 3. Cross-Event Conflict
        let hasConflict = false;
        const allEntriesFlat = Object.values(allScannedEntries).flat() as ScanEntry[];
        for (const foundEntry of allEntriesFlat) {
          if (foundEntry.citizen.tc === tc) {
            const otherEvent = allEvents.find(e => e.id === foundEntry.eventId);
            if (!otherEvent) continue;

            if (otherEvent.status === 'ACTIVE' && otherEvent.id !== event.id) {
              hasConflict = true; break;
            }

            const currentStart = new Date(event.startDate).getTime();
            const currentEnd = new Date(event.endDate).getTime();
            const otherStart = new Date(otherEvent.startDate).getTime();
            const otherEnd = new Date(otherEvent.endDate).getTime();

            if ((currentStart <= otherEnd) && (currentEnd >= otherStart)) {
              hasConflict = true; break;
            }
          }
        }

        if (hasConflict) {
          failCount++;
          continue;
        }

        // 4. DB Lookup
        let citizen = database.find(c => c.tc === tc);
        if (!citizen) {
          citizen = {
            tc: tc,
            name: 'Veri Tabanında',
            surname: 'Bulunamadı',
            validityDate: '-'
          };
        }

        newEntries.push({
          id: Date.now().toString() + Math.random().toString().slice(2),
          eventId: event.id,
          citizen: citizen,
          timestamp: currentTimestamp,
          recordedBy: currentUser.username,
          companyName: activeCompanyName || undefined
        });

        successCount++;
      }

      if (newEntries.length > 0) {
        onBulkScan(newEntries);

        let finalMessage = `${newEntries.length} kişi eklendi. ${failCount} kişi hatalı/çakışan veya mükerrer. ${errorMsg}`;
        if (scannedList.length + newEntries.length >= event.targetCount) {
          finalMessage = `🏁 HEDEF SAYIYA ULAŞILDI! ${newEntries.length} kişi eklendi. Lütfen 'Denetimi Bitir' butonuna basın.`;
        }

        setLastScanResult({
          status: 'SUCCESS',
          message: finalMessage
        });
      } else {
        setLastScanResult({
          status: 'ERROR',
          message: `Kayıt eklenemedi. ${failCount} hata. ${errorMsg}`
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');

    const dataToExport = scannedList.map(item => {
      const status = checkWorkStatus(item.citizen.validityDate);
      return {
        "TC Kimlik No": item.citizen.tc,
        "Ad": item.citizen.name,
        "Soyad": item.citizen.surname,
        "Şirket": item.companyName || '-',
        "Geçerlilik Tarihi": item.citizen.validityDate,
        "Durum": status.text,
        "Okutma Saati": item.timestamp,
        "Kaydeden": item.recordedBy,
        "Etkinlik": event.name
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Katılımcı Listesi");
    XLSX.writeFile(wb, `${event.name}.xlsx`);
  };

  const handleFinishAudit = async () => {
    await exportToExcel();

    const diff = Date.now() - startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const formattedDuration = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');

    setDurationStr(formattedDuration);
    setShowSummary(true);
  };

  const checkWorkStatus = (dateStr: string) => {
    if (!dateStr || dateStr === '-' || dateStr.trim() === '') {
      return { text: 'BELİRSİZ', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700 dark:text-gray-400' };
    }

    let targetDate: Date | null = null;
    if (dateStr.includes('-') && dateStr.length === 10) {
      targetDate = new Date(dateStr);
    } else if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
      return { text: 'TARİH HATALI', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700 dark:text-gray-400' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate >= today) {
      return { text: 'ÇALIŞIR', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' };
    } else {
      return { text: 'ÇALIŞAMAZ', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
    }
  };

  // Determine effective target for progress display (company-specific)
  const effectiveTarget = activeCompanyName
    ? (event.companies?.find(c => c.name === activeCompanyName)?.count || event.targetCount)
    : event.targetCount;
  const progressPercentage = Math.min(100, Math.round((scannedList.length / effectiveTarget) * 100));
  // Finish button requires TOTAL event target (all companies combined)
  const isTargetReached = scannedList.length >= event.targetCount;

  if (showSummary) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Denetleme Tamamlandı</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Etkinlik denetimi başarıyla sonlandırıldı ve Excel dosyası indirildi.</p>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-6">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Clock size={12} />
              Tamamlama Süresi
            </div>
            <div className="text-2xl font-mono font-bold text-gray-800 dark:text-white">
              {durationStr}
            </div>
          </div>

          <button
            onClick={() => onFinish(durationStr)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-6 rounded-xl transition text-sm"
          >
            Ana Ekrana Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-white truncate max-w-xs sm:max-w-lg">
            {formatEventName(event.name)}
            {activeCompanyName && (
              <span className="ml-2 text-xs font-medium text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                {activeCompanyName}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {dbStatus === 'LOADING' ? (
                <><Loader2 size={10} className="animate-spin" /> Veritabanı Yükleniyor...</>
              ) : (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'READY' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  {dbStatus === 'READY' ? 'Veritabanı Hazır' : 'Veritabanı Hatası'}
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
            <UserIcon size={12} />
            {currentUser.username}
          </div>
          <button onClick={onExit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>İlerleme</span>
          <span>{scannedList.length} / {effectiveTarget} (%{progressPercentage})</span>
        </div>
        <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col items-center">

        {/* Scanner Area */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-4">TC Kimlik Numarası Girin</h2>

            <form onSubmit={handleManualScan} className="flex w-full max-w-lg gap-2">
              <input
                ref={inputRef}
                type="text"
                maxLength={11}
                value={tcInput}
                onChange={handleInputChange}
                className="flex-1 bg-gray-700 dark:bg-gray-700 text-white text-sm sm:text-base font-mono placeholder-gray-400 border-none rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ backgroundColor: '#374151' }}
                placeholder="11 haneli TC No"
              />
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 py-2 text-sm rounded-lg transition"
              >
                Okut
              </button>

              {isAdmin && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 text-sm rounded-lg transition flex items-center gap-1.5"
                    title="Excel Listesi Yükle"
                  >
                    <Upload size={16} /> Excel Yükle
                  </button>
                </>
              )}
            </form>

            {/* Status Message */}
            {lastScanResult.status !== 'IDLE' && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg w-full max-w-lg ${lastScanResult.status === 'SUCCESS'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}>
                {lastScanResult.status === 'SUCCESS' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <div className="flex-1">
                  <p className="text-xs font-bold">{lastScanResult.message}</p>
                  {lastScanResult.citizen && (
                    <div className="text-xs opacity-90 mt-0.5">
                      <p>{lastScanResult.citizen.name} {lastScanResult.citizen.surname}</p>
                      <p className="font-mono mt-0.5 text-gray-600 dark:text-gray-300 scale-90 origin-left">Geçerlilik Tarihi: {lastScanResult.citizen.validityDate}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex justify-between items-center mb-2">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Okutulan Kişiler</h3>
          <div className="flex gap-2">
            <button
              onClick={exportToExcel}
              disabled={scannedList.length === 0}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Excel'e Aktar
            </button>
            {/* Partial Finish Button */}
            {!isTargetReached && scannedList.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Hedef sayıya ulaşılmadı. Yine de denetimi bitirmek istiyor musunuz?')) {
                    handleFinishAudit();
                  }
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Eksik Personel İle Bitir
              </button>
            )}

            <button
              onClick={handleFinishAudit}
              disabled={!isTargetReached}
              className={`text-white px-3 py-1.5 rounded-lg text-xs font-medium transition ${isTargetReached
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-70'
                }`}
            >
              Denetimi Bitir
            </button>
          </div>
        </div>

        {/* List */}
        {scannedList.length > 0 ? (
          <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-center text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-8">NO</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">TC No</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Geçerlilik Tarihi</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Durum</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Saat</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Kaydeden</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">İŞLEM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {scannedList.map((entry, index) => {
                  const status = checkWorkStatus(entry.citizen.validityDate);
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{index + 1}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-200 font-mono">{entry.citizen.tc}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-200 font-medium">
                        {entry.citizen.name} {entry.citizen.surname}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono">
                        {entry.citizen.validityDate}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${status.bg} ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{entry.timestamp}</td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                          {entry.recordedBy}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => onDelete(entry)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                          title="Kaydı Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-8 text-center text-gray-400 dark:text-gray-600">
            <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
              <span className="text-xl font-bold text-gray-300 dark:text-gray-600">L</span>
            </div>
            <p className="text-xs">Henüz kayıt eklenmedi</p>
          </div>
        )}

      </div>

      {/* Floating Chat Icon */}
      <button className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-2.5 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700">
        <MessageSquare size={20} />
      </button>

    </div>
  );
};

export default AuditScreen;