import React, { useState, useRef, useEffect } from 'react';
import { Event, Citizen, ScanEntry, User, UserRole } from '../types';
import { MOCK_CITIZEN_DB } from '../constants';
import { Download, X, CheckCircle, AlertCircle, MessageSquare, Database, Loader2, Trash2, User as UserIcon, Clock, Upload, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';



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
  onMarkPassive?: (duration: string) => void;
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
  onMarkPassive,
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
  const [showSummary, setShowSummary] = useState(() => {
    return localStorage.getItem('geds_show_summary_for') === event.id;
  });
  const [durationStr, setDurationStr] = useState(() => {
    return localStorage.getItem('geds_summary_duration') || '';
  });
  const [isScanning, setIsScanning] = useState(false); // Mükerrer kayıt önleme için
  const [isExporting, setIsExporting] = useState(false);
  const [fullScannedList, setFullScannedList] = useState<ScanEntry[]>([]);
  const [isFullListLoaded, setIsFullListLoaded] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // Reset fetch states if activeCompanyName changes
  useEffect(() => {
    setIsFullListLoaded(false);
    setFullScannedList([]);
  }, [activeCompanyName]);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

  const handleFetchAllScans = async () => {
    setIsLoadingAll(true);
    try {
      let q;
      if (activeCompanyName) {
        q = query(collection(db, 'scanned_entries'),
          where('eventId', '==', event.id),
          where('companyName', '==', activeCompanyName));
      } else {
        q = query(collection(db, 'scanned_entries'),
          where('eventId', '==', event.id));
      }
      const snapshot = await getDocs(q);
      const allData = snapshot.docs.map(doc => doc.data() as ScanEntry);
      setFullScannedList(allData);
      setIsFullListLoaded(true);
    } catch (e) {
      console.error(e);
      alert('Tüm liste çekilemedi.');
    } finally {
      setIsLoadingAll(false);
    }
  };

  const mergedList = React.useMemo(() => {
    if (!isFullListLoaded) return scannedList;
    const map = new Map<string, ScanEntry>();
    fullScannedList.forEach(item => map.set(item.id, item));
    scannedList.forEach(item => map.set(item.id, item));
    return Array.from(map.values()).sort((a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0));
  }, [scannedList, fullScannedList, isFullListLoaded]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape tuşu ile çıkış yapma (geri menüye dönme)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Fetch from Google Sheets - OPTIMIZED CACHE (24 Hours) - Sıkıştırılmış veri
  const loadData = async () => {
    const CACHE_KEY = 'geds_worker_db_v3_compressed';
    const TIME_KEY = 'geds_worker_db_time_v3';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Saat

    try {
      // 1. Cache kontrolü (sıkıştırılmış format)
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(TIME_KEY);

      if (cachedData && cachedTime) {
        const timeSinceCache = Date.now() - parseInt(cachedTime);
        const hoursLeft = Math.round((CACHE_DURATION - timeSinceCache) / (60 * 60 * 1000) * 10) / 10;

        if (timeSinceCache < CACHE_DURATION) {
          console.log(`✅ Veritabanı cache'den yüklendi (${hoursLeft} saat kaldı) - Google Sheets OKUNMADI`);
          // Decompress: "TC|Name|Date" formatından Citizen'a dönüştür
          const compressed = JSON.parse(cachedData) as string[];
          const onlineCitizens = compressed.map(line => {
            const [tc, name, validityDate] = line.split('|');
            return { tc, name, surname: '', validityDate };
          });
          setDatabase([...onlineCitizens, ...MOCK_CITIZEN_DB]);
          setDbStatus('READY');
          onDatabaseUpdate(onlineCitizens);
          return; // ← ERKEN DÖNDÜ, GOOGLE SHEETS'E İSTEK GÖNDERİLMEDİ
        }
      }

      // 2. Cache yoksa veya süresi dolmuşsa Google Sheets'ten çek
      console.log('⚠️ Cache süresi doldu veya yok. Google Sheets\'ten veri çekiliyor...');
      setDbStatus('LOADING');
      const workerRecords = await fetchSheetData();
      console.log(`📥 Google Sheets'ten ${workerRecords.length} kayıt alındı`);

      if (workerRecords.length > 0) {
        const onlineCitizens = workerRecords.map(r => ({
          tc: r.tc,
          name: r.fullName,
          surname: '',
          validityDate: r.expiryDate
        }));

        setDatabase([...onlineCitizens, ...MOCK_CITIZEN_DB]);
        setDbStatus('READY');
        onDatabaseUpdate(onlineCitizens);

        // 3. Cache'e sıkıştırılmış formatta kaydet (70% daha küçük)
        try {
          // Compress: Her kayıt "TC|Name|Date" formatına dönüştürülür
          const compressed = onlineCitizens.map(c => `${c.tc}|${c.name}|${c.validityDate}`);
          localStorage.setItem(CACHE_KEY, JSON.stringify(compressed));
          localStorage.setItem(TIME_KEY, Date.now().toString());
          const sizeKB = Math.round(JSON.stringify(compressed).length / 1024);
          console.log(`💾 Veritabanı cache'e kaydedildi (${sizeKB} KB, 24 saat geçerli)`);
        } catch (e: any) {
          if (e.name === 'QuotaExceededError') {
            console.error("❌ LocalStorage quota aşıldı! Veritabanı çok büyük, cache kullanılamıyor.");
            console.warn("⚠️ Her etkinlikte Google Sheets'ten tekrar çekilecek.");
          } else {
            console.warn("Cache kayıt hatası:", e);
          }
        }
      } else {
        console.warn("⚠️ Google Sheets boş döndü. Mock data kullanılıyor.");
        setDatabase(MOCK_CITIZEN_DB);
        setDbStatus('ERROR');
      }
    } catch (e) {
      console.error("❌ Veritabanı yükleme hatası:", e);
      setDatabase(MOCK_CITIZEN_DB);
      setDbStatus('ERROR');
    }
  };

  useEffect(() => {
    loadData();
  }, []); // ← Boş dependency array: Sadece component mount'ta 1 kez çalışır

  // Target computations
  const effectiveTarget = activeCompanyName
    ? (event.companies?.find(c => c.name === activeCompanyName)?.count || event.targetCount)
    : event.targetCount;

  const displayCount = activeCompanyName
    ? (event.companyCounts?.[activeCompanyName.replace(/\./g, '_')] || 0)
    : (event.currentCount || 0);

  const progressPercentage = effectiveTarget > 0
    ? Math.min(100, Math.round((displayCount / effectiveTarget) * 100))
    : 0;

  const isTargetReached = (event.currentCount || 0) >= event.targetCount;
  const performScan = async (tc: string) => {
    const trimmedTC = tc.trim();

    if (!trimmedTC) return;

    // Veritabanı hazır olmadan izin verme
    if (dbStatus !== 'READY') {
      setLastScanResult({ status: 'ERROR', message: 'Veritabanı yükleniyor veya hata oluştu. Lütfen hazır olmasını bekleyin.' });
      return;
    }

    // Eğer zaten bir okutma işlemi devam ediyorsa, yeni okutmaya izin verme
    if (isScanning) {
      console.log('⚠️ Okutma işlemi devam ediyor, lütfen bekleyin...');
      return;
    }

    if (trimmedTC.length !== 11) {
      setLastScanResult({ status: 'ERROR', message: 'TC Kimlik Numarası 11 haneli olmalıdır.' });
      return;
    }

    // HEDEF SAYIYA ULAŞILDI MI KONTROLÜ - En başta kontrol et
    if (displayCount >= effectiveTarget) {
      setLastScanResult({ status: 'ERROR', message: activeCompanyName ? `🚫 ${activeCompanyName} ŞİRKETİ İÇİN HEDEF SAYIYA ULAŞILDI! Daha fazla kayıt yapılamaz.` : '🚫 TOPLAM HEDEF SAYIYA ULAŞILDI! Daha fazla kayıt yapılamaz. Lütfen "Denetimi Bitir" butonuna basın.' });
      setTcInput('');
      return;
    }
    if ((event.currentCount || 0) >= event.targetCount) {
      setLastScanResult({ status: 'ERROR', message: '🚫 TOPLAM HEDEF SAYIYA ULAŞILDI! Daha fazla kayıt yapılamaz. Lütfen "Denetimi Bitir" butonuna basın.' });
      setTcInput('');
      return;
    }

    // Okutma işlemini başlat
    setIsScanning(true);

    // Check existing in list (across ALL companies in this event)
    const alreadyScanned = scannedList.find(s => s.citizen.tc === trimmedTC);
    if (alreadyScanned) {
      if (alreadyScanned.companyName && alreadyScanned.companyName !== activeCompanyName) {
        setLastScanResult({ status: 'ERROR', message: `MÜKERRER! ${trimmedTC} TC kimlik numaralı şahıs ${alreadyScanned.companyName} şirketinde kayda alındı.` });
      } else {
        setLastScanResult({ status: 'ERROR', message: 'MÜKERRER KAYIT! Bu kişi zaten listeye eklendi.' });
      }
      setTcInput('');
      setIsScanning(false); // Hata durumunda scanning'i bitir
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Cross-Event Validation (Optimized Async)
    const conflictError = await onCheckConflict(trimmedTC, event.id);

    if (conflictError) {
      setLastScanResult({ status: 'ERROR', message: conflictError, citizen: { tc: trimmedTC, name: 'Çakışma', surname: 'Tespit Edildi', validityDate: '-' } });
      setTcInput('');
      setIsScanning(false); // Hata durumunda scanning'i bitir
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // ŞİRKET HEDEF KONTROLÜ (artık yukarıda yapılıyor)

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

    // Bilgilendirme mesajları (hedef kontrolü yukarıda yapıldı)
    if (activeCompanyName) {
      if (displayCount + 1 >= effectiveTarget) {
        message = `✅ ${activeCompanyName} şirketinin hedef sayısına ulaşıldı! (${displayCount + 1}/${effectiveTarget})`;
      }
    }

    // Check if we hit the total target with this scan
    if ((event.currentCount || 0) + 1 >= event.targetCount) {
      message = "🏁 TÜM ŞİRKETLERİN TOPLAM HEDEF SAYISINA ULAŞILDI! Lütfen 'Denetimi Bitir' butonuna basın.";
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

    // Okutma işlemini bitir
    setIsScanning(false);

    // Hedef sayıya ulaşılmadıysa input'a focus yap
    if (displayCount + 1 < effectiveTarget) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    performScan(tcInput);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Hedef sayıya ulaşıldıysa input değişikliğine izin verme
    if (displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount) {
      return;
    }

    const val = e.target.value.replace(/\D/g, '');
    setTcInput(val);

    if (val.length === 11 && !isScanning) {
      performScan(val);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (dbStatus !== 'READY') {
      setLastScanResult({ status: 'ERROR', message: 'Veritabanı yükleniyor veya hata oluştu. Lütfen hazır olmasını bekleyin.' });
      e.target.value = '';
      return;
    }

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
      // Flatten data to get just TCs from first available column
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.length === 0) continue;

        const tcVal = row.find(cell => cell !== undefined && cell !== null && cell !== '');
        if (!tcVal) continue;

        const tc = String(tcVal).trim().replace(/\D/g, '');

        if (tc.length !== 11) continue;

        if ((event.currentCount || 0) + newEntries.length >= event.targetCount) {
          errorMsg = 'Toplam hedef limite ulaşıldı.';
          break;
        }

        // ŞİRKET HEDEF KONTROLÜ - Excel yüklemede de şirket hedefini kontrol et
        if (activeCompanyName && effectiveTarget > 0) {
          const companyEntriesInBatch = newEntries.filter(e => e.companyName === activeCompanyName).length;
          if (displayCount + companyEntriesInBatch >= effectiveTarget) {
            errorMsg = `${activeCompanyName} şirketinin hedef sayısına ulaşıldı (${effectiveTarget}).`;
            break;
          }
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

        const timestamp = Date.now();
        const uniqueId = `${event.id}_${tc}_${timestamp}_${Math.random().toString().slice(2, 8)}`;

        newEntries.push({
          id: uniqueId,
          eventId: event.id,
          citizen: citizen,
          timestamp: currentTimestamp,
          recordedBy: currentUser.username,
          companyName: activeCompanyName || undefined,
          serverTimestamp: timestamp // CRITICAL: Firestore için gerekli
        });

        successCount++;
      }

      if (newEntries.length > 0) {
        onBulkScan(newEntries);

        let finalMessage = `${newEntries.length} kişi eklendi. ${failCount} kişi hatalı/çakışan veya mükerrer. ${errorMsg}`;
        if ((event.currentCount || 0) + newEntries.length >= event.targetCount) {
          finalMessage = `🏁 HEDEF SAYIYA ULAŞILDI! ${newEntries.length} kişi eklendi. Lütfen 'Denetimi Bitir' butonuna basın.`;
        } else if (activeCompanyName && displayCount + newEntries.length >= effectiveTarget) {
          finalMessage = `🏁 ${activeCompanyName} ŞİRKETİ İÇİN HEDEF SAYIYA ULAŞILDI! ${newEntries.length} kişi eklendi.`;
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
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');

      // Fetch full data from Firestore on demand (to bypass 200 limit)
      let allData: ScanEntry[] = [];
      try {
        let q;
        if (activeCompanyName) {
          q = query(collection(db, 'scanned_entries'),
            where('eventId', '==', event.id),
            where('companyName', '==', activeCompanyName));
        } else {
          q = query(collection(db, 'scanned_entries'),
            where('eventId', '==', event.id));
        }
        const snapshot = await getDocs(q);
        allData = snapshot.docs.map(doc => doc.data() as ScanEntry);
        // Sort by serverTimestamp descending
        allData.sort((a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0));
      } catch (err) {
        console.error("Error fetching full data for export:", err);
        alert('Tüm liste çekilemedi, ekrandaki mevcut liste indirilecek.');
        allData = companyFilteredList;
      }

      // Çoklu şirketli etkinliklerde sadece seçili şirketin verilerini export et
      const dataToExport = allData.map(item => {
        const status = checkWorkStatus(item.citizen.validityDate);

        let ad = item.citizen.name || '';
        let soyad = item.citizen.surname || '';

        // Eğer soyad yoksa ve ad boşluk içeriyorsa son kelimeyi soyad olarak ayır
        if (!soyad && ad.trim().includes(' ')) {
          const parts = ad.trim().split(/\s+/);
          soyad = parts.pop() || '';
          ad = parts.join(' ');
        }

        return {
          "TC Kimlik No": item.citizen.tc,
          "Ad": ad,
          "Soyad": soyad,
          "Geçerlilik Tarihi": item.citizen.validityDate,
          "Durum": status.text,
          "Okutma Saati": item.timestamp,
          "Kaydeden": item.recordedBy,
          "Şirket": item.companyName || '-',
          "Etkinlik": event.name
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Katılımcı Listesi");

      // Dosya adına şirket adını ekle (varsa)
      const fileName = activeCompanyName
        ? `${event.name}_${activeCompanyName}.xlsx`
        : `${event.name}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error(e);
      alert('Excel oluşturulurken hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  // Tüm şirketlerin verilerini export et (Denetimi Bitir için)
  const exportAllCompaniesToExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');

      // Fetch full data from Firestore on demand
      let allData: ScanEntry[] = [];
      try {
        const q = query(collection(db, 'scanned_entries'), where('eventId', '==', event.id));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data() as ScanEntry);
        data.sort((a, b) => (b.serverTimestamp || 0) - (a.serverTimestamp || 0));
        allData = data;
      } catch (err) {
        console.error("Error fetching full data:", err);
        allData = scannedList;
      }

      // TÜM kayıtları export et (şirket filtresi olmadan)
      const dataToExport = allData.map(item => {
        const status = checkWorkStatus(item.citizen.validityDate);

        let ad = item.citizen.name || '';
        let soyad = item.citizen.surname || '';

        // Eğer soyad yoksa ve ad boşluk içeriyorsa son kelimeyi soyad olarak ayır
        if (!soyad && ad.trim().includes(' ')) {
          const parts = ad.trim().split(/\s+/);
          soyad = parts.pop() || '';
          ad = parts.join(' ');
        }

        return {
          "TC Kimlik No": item.citizen.tc,
          "Ad": ad,
          "Soyad": soyad,
          "Geçerlilik Tarihi": item.citizen.validityDate,
          "Durum": status.text,
          "Okutma Saati": item.timestamp,
          "Kaydeden": item.recordedBy,
          "Şirket": item.companyName || '-',
          "Etkinlik": event.name
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tüm Şirketler");

      // Dosya adı: Etkinlik adı + "Tüm Şirketler"
      const fileName = `${event.name}_Tum_Sirketler.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error(e);
      alert('Excel oluşturulurken hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFinishAudit = async () => {
    const diff = Date.now() - startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const formattedDuration = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');

    // Sunucuyu hemen güncelle, kullanıcı sekmeyi kapatsa bile etkinlik passiive'e geçsin
    if (onMarkPassive) {
      onMarkPassive(formattedDuration);
    }

    // LocalStorage'a kaydet (iOS PWA indirme sırasında sayfayı yenilerse durumu kaybetmemek için)
    localStorage.setItem('geds_show_summary_for', event.id);
    localStorage.setItem('geds_summary_duration', formattedDuration);

    setDurationStr(formattedDuration);
    setShowSummary(true);

    // İndirme işlemi sayfa yenilenmesini tetikleyebileceği için en son çalıştır
    if (event.companies && event.companies.length > 0) {
      await exportAllCompaniesToExcel();
    } else {
      await exportToExcel();
    }
  };

  const handleGoDashboard = () => {
    localStorage.removeItem('geds_show_summary_for');
    localStorage.removeItem('geds_summary_duration');
    onFinish(durationStr);
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

  // Filter list by selected company for display
  const rawFilteredList = activeCompanyName
    ? mergedList.filter(s => s.companyName === activeCompanyName)
    : mergedList;

  // Limit display to 200 items initially (per company), expanding only if "Tümünü Getir" is clicked
  const companyFilteredList = isFullListLoaded
    ? rawFilteredList
    : rawFilteredList.slice(0, 200);


  if (showSummary) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-8 shadow-xl text-center border border-gray-100 dark:border-gray-700">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">Denetleme Tamamlandı</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Etkinlik denetimi başarıyla sonlandırıldı ve kişi listesi Excel formatında cihazınıza indirildi.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 mb-8 border border-gray-100 dark:border-gray-600">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-1.5">
              <Clock size={16} />
              Denetleme Süresi
            </div>
            <div className="text-4xl font-mono font-black text-gray-800 dark:text-white tracking-tight">
              {durationStr}
            </div>
          </div>

          <button
            onClick={handleGoDashboard}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Ana Ekrana Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-white truncate max-w-xs sm:max-w-lg">
            {event.name}
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
          <button
            type="button"
            onClick={onExit}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Kapat ve Çık"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>İlerleme</span>
          <span>{displayCount} / {effectiveTarget} (%{progressPercentage})</span>
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
                disabled={displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount || isScanning || dbStatus !== 'READY'}
                className="flex-1 bg-gray-700 dark:bg-gray-700 text-white text-sm sm:text-base font-mono placeholder-gray-400 border-none rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#374151' }}
                placeholder={dbStatus !== 'READY' ? "Veritabanı bekleniyor..." : (displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount ? "Hedef sayıya ulaşıldı" : "11 haneli TC No")}
              />
              <button
                type="submit"
                disabled={displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount || isScanning || tcInput.length !== 11 || dbStatus !== 'READY'}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 py-2 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScanning ? 'Okutluyor...' : 'Okut'}
              </button>

              {isAdmin && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    disabled={displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount || dbStatus !== 'READY'}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount || isScanning || dbStatus !== 'READY'}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 text-sm rounded-lg transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={dbStatus !== 'READY' ? "Veritabanı bekleniyor..." : (displayCount >= effectiveTarget || (event.currentCount || 0) >= event.targetCount ? "Hedef sayıya ulaşıldı" : "Excel Listesi Yükle")}
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
            {!isFullListLoaded && displayCount > companyFilteredList.length && (
              <button
                onClick={handleFetchAllScans}
                disabled={isLoadingAll}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingAll ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {isLoadingAll ? 'Yükleniyor...' : 'Tümünü Getir'}
              </button>
            )}
            <button
              onClick={exportToExcel}
              disabled={companyFilteredList.length === 0 || isExporting}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <><Loader2 size={14} className="animate-spin" /> Hazırlanıyor...</>
              ) : (
                <><Download size={14} /> Excel'e Aktar</>
              )}
            </button>
            {/* Partial Finish Button */}
            {!isTargetReached && companyFilteredList.length > 0 && (
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
        {companyFilteredList.length > 0 ? (
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
                {companyFilteredList.map((entry, index) => {
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

    </div>
  );
};

export default AuditScreen;