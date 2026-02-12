
import React, { useState, useMemo, useEffect } from 'react';
import { Event, User, UserRole, ScanEntry, CompanyTarget } from '../types';
import { Plus, Users, Calendar, Play, LogOut, Eye, Trash2, Edit, UserCog, Key, ShieldCheck, User as UserIcon, Activity, Archive, Download, RefreshCw, Clock, Wifi, X, CheckCircle, Sun, Moon, Folder, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Upload } from 'lucide-react';



interface AdminDashboardProps {
  currentUser: User;
  events: Event[];
  users: User[];
  scannedEntries: Record<string, ScanEntry[]>;
  onLogout: () => void;
  onStartAudit: (eventId: string, companyName?: string) => void;
  onAddEvent: (event: Event) => void;
  onDeleteEvent: (id: string) => void;
  onReactivateEvent: (id: string) => void;
  onAddUser: (user: User) => Promise<void>;
  onUpdateUser: (user: User) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateEvent: (event: Event) => void;
  onRefreshPassiveData: (eventIds: string[]) => Promise<void>;
  onSyncEvent: (eventId: string, silent?: boolean) => Promise<void>;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  events,
  users,
  scannedEntries,
  onLogout,
  onStartAudit,
  onAddEvent,
  onDeleteEvent,
  onReactivateEvent,
  onAddUser,
  onUpdateUser,
  onUpdateEvent,
  onRefreshPassiveData,
  onSyncEvent,
  isDarkMode,
  onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'USERS'>('EVENTS');
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Company Selection State
  const [companySelectEvent, setCompanySelectEvent] = useState<Event | null>(null);

  // Accordion state for passive events
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  // New Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [newEventTarget, setNewEventTarget] = useState<number | string>(5);
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');

  // Multi-Company State
  const [isMultiCompany, setIsMultiCompany] = useState(false);
  const [companyCountInput, setCompanyCountInput] = useState<number | string>(1);
  const [companyTargets, setCompanyTargets] = useState<CompanyTarget[]>([]);

  // Effect to manage company inputs array
  useEffect(() => {
    if (isMultiCompany) {
      const count = typeof companyCountInput === 'string' ? 0 : companyCountInput;
      setCompanyTargets(prev => {
        const currentLength = prev.length;
        if (count > currentLength) {
          // Add new empty targets
          const newItems = Array(count - currentLength).fill(null).map(() => ({ name: '', count: 0 }));
          return [...prev, ...newItems];
        } else if (count < currentLength) {
          // Trim array
          return prev.slice(0, count);
        }
        return prev;
      });
    }
  }, [companyCountInput, isMultiCompany]);

  // User Management State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Self Password Change State
  const [showSelfPasswordChange, setShowSelfPasswordChange] = useState(false);
  const [selfNewPassword, setSelfNewPassword] = useState('');

  // Temp state for user forms
  const [tempPassword, setTempPassword] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<UserRole[]>([UserRole.PERSONNEL]);

  const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

  // Auto-sync Continuing Events (Once per session per event)
  const [syncedEvents, setSyncedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const activeEvents = events.filter(e => e.status === 'ACTIVE');
    activeEvents.forEach(e => {
      if (!syncedEvents.has(e.id)) {
        console.log(`Auto-syncing event: ${e.name}`);
        onSyncEvent(e.id, true);
        setSyncedEvents(prev => new Set(prev).add(e.id));
      }
    });
  }, [events]); // Check whenever events list updates (e.g. initial load)

  // --- Handlers ---

  const toggleNewUserRole = (role: UserRole) => {
    setNewUserRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const toggleEditUserRole = (role: UserRole) => {
    if (editingUser) {
      const newRoles = editingUser.roles.includes(role)
        ? editingUser.roles.filter(r => r !== role)
        : [...editingUser.roles, role];
      setEditingUser({ ...editingUser, roles: newRoles });
    }
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      const updatedEvent: Event = {
        ...editingEvent,
        name: newEventName,
        targetCount: isMultiCompany ? companyTargets.reduce((sum, t) => sum + (t.count || 0), 0) : Number(newEventTarget),
        startDate: newEventStart,
        endDate: newEventEnd,
        companies: isMultiCompany ? companyTargets : undefined
      };
      onUpdateEvent(updatedEvent);
    } else {
      const newEvent: Event = {
        id: crypto.randomUUID(),
        name: newEventName,
        targetCount: isMultiCompany ? companyTargets.reduce((sum, t) => sum + (t.count || 0), 0) : Number(newEventTarget),
        currentCount: 0,
        startDate: newEventStart,
        endDate: newEventEnd,
        status: 'ACTIVE',
        companies: isMultiCompany ? companyTargets : undefined
      };
      onAddEvent(newEvent);
    }
    setNewEventName('');
    setNewEventTarget(5);
    setNewEventStart('');
    setNewEventEnd('');
    setIsMultiCompany(false);
    setCompanyCountInput(1);
    setCompanyTargets([]);
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleEventExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

      let errorLog: string[] = [];

      // --- STEP 1: Parse all rows into a temporary structure ---
      interface ParsedRow {
        eventName: string;
        companyName: string;
        target: number;
        startDate: Date;
        endDate: Date;
      }

      const parsedRows: ParsedRow[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;

        const col0 = String(row[0]).trim(); // Date
        const col1 = String(row[1]).trim(); // Time
        const col2 = String(row[2]).trim(); // Event Name
        const col4 = String(row[4] || '').trim(); // Company Name (E sütunu)

        // Skip lines that don't look like data (no digits in date col)
        if (!/\d/.test(col0)) continue;

        // Date Parse (Flexible Logic for M/D/YY, DD.MM.YYYY, YYYY-MM-DD)
        let day: number, month: number, year: number;
        const parts = col0.split(/[./-]/);

        if (parts.length === 3) {
          const p1 = parseInt(parts[0]);
          const p2 = parseInt(parts[1]);
          let p3 = parseInt(parts[2]);

          if (p3 < 100) p3 += 2000;

          if (p1 > 1000) {
            year = p1; month = p2 - 1; day = p3;
          } else {
            if (p1 > 12) {
              day = p1; month = p2 - 1; year = p3;
            } else if (p2 > 12) {
              month = p1 - 1; day = p2; year = p3;
            } else {
              if (col0.includes('.')) {
                day = p1; month = p2 - 1; year = p3;
              } else {
                month = p1 - 1; day = p2; year = p3;
              }
            }
          }
        } else {
          errorLog.push(`Satır ${i + 1}: Tarih formatı geçersiz (${col0})`);
          continue;
        }

        // Time Parse
        const timeMatches = Array.from(col1.matchAll(/(\d{1,2})[:.:](\d{2})/g));
        if (timeMatches.length < 2) {
          errorLog.push(`Satır ${i + 1}: Saat aralığı bulunamadı (${col1})`);
          continue;
        }

        const startH = parseInt(timeMatches[0][1]);
        const startM = parseInt(timeMatches[0][2]);
        const endH = parseInt(timeMatches[1][1]);
        const endM = parseInt(timeMatches[1][2]);

        // Target Logic (Check Col 6 [F] then Col 7 [G])
        let target = parseInt(row[5]);
        if (isNaN(target)) target = parseInt(row[6]);
        if (isNaN(target)) target = 50;

        const startDateObj = new Date(year!, month!, day!, startH, startM);
        const endDateObj = new Date(year!, month!, day!, endH, endM);

        if (endDateObj < startDateObj) {
          endDateObj.setDate(endDateObj.getDate() + 1);
        }

        // Format Date Part for Event Name (DD.MM.YYYY)
        const formattedDatePart = `${String(day!).padStart(2, '0')}.${String(month! + 1).padStart(2, '0')}.${year!}`;
        const eventName = `${formattedDatePart} ${col2}`;

        parsedRows.push({
          eventName: eventName.trim(),
          companyName: col4,
          target,
          startDate: startDateObj,
          endDate: endDateObj,
        });
      }

      // --- STEP 2: Group by event name ---
      const grouped: Record<string, ParsedRow[]> = {};
      parsedRows.forEach(row => {
        if (!grouped[row.eventName]) grouped[row.eventName] = [];
        grouped[row.eventName].push(row);
      });

      // --- STEP 3: Create events (merge duplicates) ---
      let addedCount = 0;
      const toLocalISO = (d: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      for (const [eventName, rows] of Object.entries(grouped)) {
        // Find earliest start and latest end
        const earliestStart = new Date(Math.min(...rows.map(r => r.startDate.getTime())));
        const latestEnd = new Date(Math.max(...rows.map(r => r.endDate.getTime())));

        if (rows.length > 1) {
          // MERGE: Multiple rows with same event name → one event with multiple companies
          const companies: CompanyTarget[] = rows.map(r => ({
            name: r.companyName || 'Şirket Belirtilmemiş',
            count: r.target
          }));
          const totalTarget = companies.reduce((sum, c) => sum + c.count, 0);

          const newEvent: Event = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            name: eventName,
            targetCount: totalTarget,
            currentCount: 0,
            startDate: toLocalISO(earliestStart),
            endDate: toLocalISO(latestEnd),
            status: 'ACTIVE',
            companies: companies
          };

          console.log(`🔀 Merged event: ${eventName} (${rows.length} şirket, toplam hedef: ${totalTarget})`);
          onAddEvent(newEvent);
          addedCount++;
        } else {
          // Single row → normal event (with company if exists)
          const row = rows[0];
          const newEvent: Event = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            name: eventName,
            targetCount: row.target,
            currentCount: 0,
            startDate: toLocalISO(earliestStart),
            endDate: toLocalISO(latestEnd),
            status: 'ACTIVE',
            companies: row.companyName ? [{ name: row.companyName, count: row.target }] : undefined
          };

          console.log(`➕ Single event: ${eventName}`);
          onAddEvent(newEvent);
          addedCount++;
        }
        await new Promise(r => setTimeout(r, 10));
      }

      if (addedCount > 0) {
        const mergedCount = Object.values(grouped).filter(g => g.length > 1).length;
        const mergedMsg = mergedCount > 0 ? `\n(${mergedCount} etkinlik aynı isimle birleştirildi)` : '';
        alert(`${addedCount} etkinlik başarıyla eklendi.${mergedMsg}`);
      } else {
        const errorMsg = errorLog.length > 0
          ? `Tespit edilen hatalar:\n${errorLog.slice(0, 5).join('\n')}`
          : 'Excel formatı uygun görünmüyor veya veri satırı bulunamadı.';
        alert(`Hiçbir etkinlik oluşturulamadı.\n${errorMsg}`);
      }

    } catch (err) {
      console.error("Excel upload error:", err);
      alert('Dosya okunurken hata oluştu.');
    }
  };

  const handleStartEditEvent = (event: Event) => {
    setEditingEvent(event);
    setNewEventName(event.name);
    setNewEventTarget(event.targetCount);
    setNewEventStart(event.startDate);
    setNewEventEnd(event.endDate);

    // Multi-company handling
    if (event.companies && event.companies.length > 0) {
      setIsMultiCompany(true);
      setCompanyCountInput(event.companies.length);
      setCompanyTargets([...event.companies]);
    } else {
      setIsMultiCompany(false);
      setCompanyCountInput(1);
      setCompanyTargets([]);
    }

    setShowEventModal(true);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: Date.now().toString(),
      username: newUserUsername,
      fullName: newUserUsername,
      password: newUserPassword,
      roles: newUserRoles
    };
    onAddUser(newUser);
    setShowAddUserModal(false);
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserRoles([UserRole.PERSONNEL]);
  };

  const handleSaveUserRole = () => {
    if (editingUser) {
      onUpdateUser(editingUser);
      setEditingUser(null);
    }
  };

  const handleSavePassword = () => {
    if (showPasswordReset && tempPassword) {
      onUpdateUser({ ...showPasswordReset, password: tempPassword });
      setShowPasswordReset(null);
      setTempPassword('');
    }
  };

  const handleSaveSelfPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (selfNewPassword) {
      onUpdateUser({ ...currentUser, password: selfNewPassword });
      setShowSelfPasswordChange(false);
      setSelfNewPassword('');
    }
  };

  const handleStartAuditClick = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event?.companies && event.companies.length > 1) {
      // Show company selection modal
      setCompanySelectEvent(event);
    } else if (event?.companies && event.companies.length === 1) {
      // Single company, start directly with company name
      onStartAudit(eventId, event.companies[0].name);
    } else {
      // No companies, start directly
      onStartAudit(eventId);
    }
  };

  const checkWorkStatus = (dateInput: any) => {
    const dateStr = String(dateInput || '').trim();

    if (!dateStr || dateStr === '-' || dateStr === 'undefined' || dateStr === 'null') {
      return { text: 'BELİRSİZ', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300' };
    }

    let targetDate: Date | null = null;

    // Check if parts match YYYY-MM-DD or DD.MM.YYYY
    if (dateStr.includes('-')) {
      targetDate = new Date(dateStr);
    } else if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        // Fix for potential string parts " 01 "
        const day = parseInt(parts[0].trim());
        const month = parseInt(parts[1].trim());
        const year = parseInt(parts[2].trim());
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          targetDate = new Date(year, month - 1, day);
        }
      }
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
      return { text: 'TARİH HATALI', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate >= today) {
      return { text: 'ÇALIŞIR', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' };
    } else {
      return { text: 'ÇALIŞAMAZ', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
    }
  };

  const handleExportExcel = async () => {
    if (!viewingEvent) return;
    const entries = scannedEntries[viewingEvent.id] || [];

    const XLSX = await import('xlsx');

    const dataToExport = entries.map(item => {
      const status = checkWorkStatus(item.citizen.validityDate);
      return {
        "TC Kimlik No": item.citizen.tc,
        "Ad": item.citizen.name,
        "Soyad": item.citizen.surname,
        "Geçerlilik Tarihi": item.citizen.validityDate,
        "Durum": status.text,
        "Okutma Saati": item.timestamp,
        "Kaydeden": item.recordedBy,
        "Etkinlik": viewingEvent.name
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Katılımcı Listesi");
    XLSX.writeFile(wb, `${viewingEvent.name} _Katilimci_Listesi.xlsx`);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Revised logic:
  // Continuing = Active + Count > 0
  const continuingEvents = events.filter(e => e.status === 'ACTIVE' && e.currentCount > 0);
  // Pending = Active + Count == 0 (This replaces the main list)
  const pendingEvents = events.filter(e => e.status === 'ACTIVE' && e.currentCount === 0);
  // We use pendingEvents for the main "Active Audits" list now
  const activeEvents = pendingEvents;
  // --- Passive Events Logic ---
  const allPassiveEvents = events.filter(e => e.status === 'PASSIVE')
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

  const recentPassiveEvents = allPassiveEvents.slice(0, 35);

  // Group by "Month Year" (e.g., "Şubat 2026")
  const groupedPassiveEvents = allPassiveEvents.reduce((acc, event) => {
    const date = new Date(event.endDate);
    // Capitalize first letter of month
    const monthName = date.toLocaleString('tr-TR', { month: 'long' });
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = date.getFullYear();
    const key = `${formattedMonth} ${year} `;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Etkinlik Sistemi</h1>
            <span className="bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 text-xs px-2 py-1 rounded-full font-bold uppercase">
              {isAdmin ? 'Yönetici' : 'Kullanıcı'}
            </span>
            <span className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase border border-green-200 dark:border-green-800 animate-pulse">
              <Wifi size={10} />
              Canlı
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 truncate max-w-[120px] sm:max-w-none">
              <UserIcon size={16} />
              {currentUser.fullName}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onToggleTheme}
                className="px-2 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title="Tema Değiştir"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={() => setShowSelfPasswordChange(true)}
                className="px-2 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                title="Şifre Değiştir"
              >
                <Key size={16} />
              </button>
              <button
                onClick={onLogout}
                className="px-2 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                title="Çıkış"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-gray-800 dark:text-white tracking-tight">
                {activeTab === 'EVENTS' ? `Aktif Denetimler (${activeEvents.length})` : 'Sistem Kullanıcıları'}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('EVENTS')}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border ${activeTab === 'EVENTS' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white' : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'} `}
                >
                  <Calendar size={16} /> Etkinlik
                </button>
                <button
                  onClick={() => setActiveTab('USERS')}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border ${activeTab === 'USERS' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white' : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'} `}
                >
                  <Users size={16} /> Kullanıcı
                </button>
              </>
            )}

            {isAdmin && activeTab === 'EVENTS' && (
              <>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="flex-1 sm:flex-none px-3 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700 shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Ekle
                </button>
                <div className="relative">
                  <button
                    onClick={() => document.getElementById('event-excel-upload')?.click()}
                    className="flex-1 sm:flex-none h-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"
                  >
                    <Upload size={16} /> Excel Yükle
                  </button>
                  <input
                    type="file"
                    id="event-excel-upload"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleEventExcelUpload}
                  />
                </div>
              </>
            )}

            {isAdmin && activeTab === 'USERS' && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex-1 sm:flex-none px-3 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700 shadow-sm flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Ekle
              </button>
            )}
          </div>
        </div>

        {activeTab === 'EVENTS' ? (
          <>
            {/* Active Event List */}
            <div className="space-y-2">
              {activeEvents.map((event) => {
                const isLate = new Date(event.startDate) < new Date();
                const textColor = isLate ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white';
                const realCount = event.currentCount;

                return (
                  <div key={event.id} className={`bg-white dark:bg-[#0f172a] border ${isLate ? 'border-red-500/20' : 'border-gray-200 dark:border-gray-800/80'} p-2.5 rounded-xl shadow-sm hover:shadow-md transition-all`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        {isLate && realCount === 0 && (
                          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-[10px] font-bold animate-pulse">
                            <AlertTriangle size={12} />
                            <span>VERİ GİRİŞİ YAPILMAMIŞ</span>
                          </div>
                        )}
                        <h4 className={`font-bold ${textColor} text-xs`}>
                          {event.name}
                        </h4>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-[#1e293b]/50 text-gray-500 dark:text-gray-400 text-[10px] rounded border border-gray-200 dark:border-gray-700/50 font-medium">
                            <Clock size={10} />
                            {formatDateTime(event.startDate)}
                          </div>
                          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">-</span>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-[#1e293b]/50 text-gray-500 dark:text-gray-400 text-[10px] rounded border border-gray-200 dark:border-gray-700/50 font-medium">
                            <Clock size={10} />
                            {formatDateTime(event.endDate)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-tight">
                          <span>Hedef: {event.targetCount}</span>
                          <span className="text-gray-300 dark:text-gray-600 mx-1">•</span>
                          <span className={realCount > 0 ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>
                            {realCount} / {event.targetCount}
                          </span>
                        </div>

                        {/* User Scan Counts */}
                        {(() => {
                          const userStats = event.userCounts || {};

                          // Fallback to calculated stats ONLY if userCounts is missing (for old events)
                          const displayStats = Object.keys(userStats).length > 0
                            ? userStats
                            : (scannedEntries[event.id] || []).reduce((acc, entry) => {
                              const user = entry.recordedBy || 'Bilinmiyor';
                              acc[user] = (acc[user] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>);

                          if (Object.keys(displayStats).length === 0) return null;

                          return (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {Object.entries(displayStats)
                                .filter(([_, count]) => count > 0) // Sadece 0'dan büyük olanları göster
                                .sort((a, b) => b[1] - a[1]) // En çok okutandan aza sırala
                                .map(([username, count]) => (
                                  <div key={username} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-[9px] font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                                    <UserIcon size={10} />
                                    <span>{username}:</span>
                                    <span className="bg-blue-100 dark:bg-blue-800 px-1 rounded-sm">{count}</span>
                                  </div>
                                ))}
                            </div>
                          );
                        })()}

                        <div className="w-full max-w-sm bg-gray-100 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (realCount / event.targetCount) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 sm:self-start mt-0.5">
                        <button
                          onClick={() => handleStartAuditClick(event.id)}
                          className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center group/play"
                          title="Denetimi Başlat"
                        >
                          <Play size={16} className="fill-current" />
                        </button>
                        <button
                          onClick={() => setViewingEvent(event)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Listeyi Gör"
                        >
                          <Eye size={16} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleStartEditEvent(event)}
                              className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-all"
                              title="Düzenle"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => onDeleteEvent(event.id)}
                              className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-all"
                              title="Sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeEvents.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-dashed">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aktif Etkinlik Yok</h3>
                  {isAdmin && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Yeni bir etkinlik oluşturarak başlayın.</p>}
                </div>
              )}
            </div>

            {/* Continuing Audits Section */}
            {
              continuingEvents.length > 0 && (
                <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="text-blue-600 dark:text-blue-400" size={20} />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Devam Eden Denetimler ({continuingEvents.length})</h3>
                  </div>
                  <div className="space-y-4">
                    {continuingEvents.map(event => {
                      const entries = scannedEntries[event.id] || [];
                      // FIX: Use event.currentCount for reliable real-time totals (dashboard doesn't fetch all entries)
                      const realCount = event.currentCount || entries.length;
                      const isLate = new Date(event.startDate) < new Date();

                      return (
                        <div key={event.id} className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/80 p-4 rounded-xl shadow-sm hover:shadow-md transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1 space-y-2 w-full">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                                  {event.name}
                                </h4>
                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full border border-green-200 dark:border-green-800">
                                  DEVAM EDİYOR
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-[#1e293b]/50 text-gray-500 dark:text-gray-400 text-[10px] rounded border border-gray-200 dark:border-gray-700/50 font-medium">
                                  <Clock size={10} />
                                  {formatDateTime(event.startDate)}
                                </div>
                                <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">-</span>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-[#1e293b]/50 text-gray-500 dark:text-gray-400 text-[10px] rounded border border-gray-200 dark:border-gray-700/50 font-medium">
                                  <Clock size={10} />
                                  {formatDateTime(event.endDate)}
                                </div>
                              </div>

                              {/* Overall Totals */}
                              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-tight">
                                <span>Toplam Hedef: {event.targetCount}</span>
                                <span className="text-gray-300 dark:text-gray-600 mx-1">•</span>
                                <span className={`font-bold ${realCount >= event.targetCount ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                  {realCount} / {event.targetCount} (%{Math.min(100, Math.round((realCount / event.targetCount) * 100))})
                                </span>
                              </div>

                              {/* Company Cards */}
                              {event.companies && event.companies.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                  {event.companies.map((company, cIdx) => {
                                    const companyEntries = entries.filter(e => e.companyName === company.name);
                                    // FIX: Use Maximum of (entries count) and (Firestore counter) to ensure reliability
                                    // This handles cases where:
                                    // 1. Mobile view (entries empty, counter has data) -> Counter used
                                    // 2. Desktop view (entries loaded) -> Entries used
                                    // 3. Partial sync/lag -> Maximum value used
                                    const safeKey = company.name.replace(/\./g, '_');
                                    const firestoreCount = event.companyCounts?.[safeKey] || 0;
                                    const companyCount = Math.max(companyEntries.length, firestoreCount);
                                    const companyPct = Math.min(100, Math.round((companyCount / company.count) * 100));
                                    const companyReached = companyCount >= company.count;

                                    // Per-user stats for this company
                                    // FIX: Prioritize entries -> specific companyUserCounts -> global (only if single company)
                                    let companyUserStats: Record<string, number> = {};

                                    if (companyEntries.length > 0) {
                                      companyUserStats = companyEntries.reduce((acc, entry) => {
                                        const user = entry.recordedBy || 'Bilinmiyor';
                                        acc[user] = (acc[user] || 0) + 1;
                                        return acc;
                                      }, {} as Record<string, number>);
                                    } else if (event.companyUserCounts) {
                                      const safeKey = company.name.replace(/\./g, '_');
                                      const prefix = `${safeKey}__`;
                                      companyUserStats = Object.entries(event.companyUserCounts)
                                        .filter(([k]) => k.startsWith(prefix))
                                        .reduce((acc, [k, v]) => {
                                          acc[k.substring(prefix.length)] = v;
                                          return acc;
                                        }, {} as Record<string, number>);
                                    } else if (event.companies?.length === 1) {
                                      // Fallback to global stats ONLY if single company (safe assumption)
                                      companyUserStats = event.userCounts || {};
                                    }

                                    return (
                                      <div key={cIdx} className={`p-2.5 rounded-lg border ${companyReached
                                        ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                                        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                                        }`}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-bold text-[11px] text-gray-800 dark:text-gray-200">
                                            {company.name}
                                          </span>
                                          {companyReached && (
                                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/40 px-1.5 py-0.5 rounded-full">
                                              <CheckCircle size={10} /> TAMAM
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                                          <span className={`font-bold ${companyReached ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                            {companyCount > 0 ? companyCount : (event.companies?.length === 1 ? realCount : companyCount)} / {company.count}
                                          </span>
                                          <span>(%{Math.min(100, Math.round(((companyCount > 0 ? companyCount : (event.companies?.length === 1 ? realCount : companyCount)) / company.count) * 100))})</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1 rounded-full overflow-hidden mb-1.5">
                                          <div
                                            className={`h-full transition-all duration-500 rounded-full ${companyReached ? 'bg-green-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(100, Math.round(((companyCount > 0 ? companyCount : (event.companies?.length === 1 ? realCount : companyCount)) / company.count) * 100))}%` }}
                                          ></div>
                                        </div>
                                        {Object.keys(companyUserStats).length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {Object.entries(companyUserStats).map(([username, count]) => (
                                              <div key={username} className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-700/50 text-[8px] font-medium text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-600/50">
                                                <UserIcon size={8} />
                                                <span>{username}: {count}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* User Scan Counts (for non-company events) */}
                              {(!event.companies || event.companies.length === 0) && (() => {
                                // FIX: Prioritize event.userCounts because 'entries' might be partial (incomplete) in dashboard view.
                                // Only calculate from entries if userCounts is missing.
                                const hasUserCounts = event.userCounts && Object.keys(event.userCounts).length > 0;

                                const userStats = hasUserCounts
                                  ? event.userCounts
                                  : entries.reduce((acc, entry) => {
                                    const user = entry.recordedBy || 'Bilinmiyor';
                                    acc[user] = (acc[user] || 0) + 1;
                                    return acc;
                                  }, {} as Record<string, number>);

                                if (!userStats || Object.keys(userStats).length === 0) return null;

                                return (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {Object.entries(userStats).map(([username, count]) => (
                                      <div key={username} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-[9px] font-bold text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/50">
                                        <UserIcon size={10} />
                                        <span>{username}:</span>
                                        <span className="bg-green-100 dark:bg-green-800 px-1 rounded-sm">{count}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              <div className="w-full max-w-sm bg-gray-100 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                                <div
                                  className="bg-green-600 h-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, (realCount / event.targetCount) * 100)}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 sm:self-start mt-0.5">
                              <button
                                onClick={() => handleStartAuditClick(event.id)}
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center"
                                title="Denetime Devam Et"
                              >
                                <Play size={16} className="fill-current" />
                              </button>
                              <button
                                onClick={() => setViewingEvent(event)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all"
                                title="Listeyi Gör"
                              >
                                <Eye size={16} />
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleStartEditEvent(event)}
                                    className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-all"
                                    title="Düzenle"
                                  >
                                    <Edit size={16} />
                                  </button>

                                  <button
                                    onClick={() => onDeleteEvent(event.id)}
                                    className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-all"
                                    title="Sil"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            }

            {/* Passive Events Section - Only Visible to Admins */}
            {
              isAdmin && Object.keys(groupedPassiveEvents).length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Archive className="text-gray-500 dark:text-gray-400" size={20} />
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        Pasif Etkinlikler
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 hidden sm:inline">
                          (Toplam {allPassiveEvents.length} etkinlik, son {recentPassiveEvents.length}'inin verileri gösteriliyor)
                        </span>
                      </h3>
                    </div>
                    <button
                      id="refresh-passive-btn"
                      onClick={() => {
                        const icon = document.getElementById('refresh-icon-spin');
                        if (icon) {
                          icon.classList.add('animate-spin');
                          setTimeout(() => icon.classList.remove('animate-spin'), 1000);
                        }
                        onRefreshPassiveData(recentPassiveEvents.map(e => e.id));
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2 shadow-sm"
                      title="Listeyi Yenile"
                    >
                      <RefreshCw id="refresh-icon-spin" size={14} />
                      <span className="hidden sm:inline">Yenile</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {Object.entries(groupedPassiveEvents).map(([monthYear, events]) => (
                      <div key={monthYear} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                        <button
                          onClick={() => toggleMonth(monthYear)}
                          className="w-full flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition border-b border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            <Folder className="text-gray-400 dark:text-gray-500" size={20} />
                            <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">{monthYear}</span>
                            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                              {events.length}
                            </span>
                          </div>
                          {expandedMonths.includes(monthYear)
                            ? <ChevronUp className="text-gray-400" size={20} />
                            : <ChevronDown className="text-gray-400" size={20} />
                          }
                        </button>

                        {expandedMonths.includes(monthYear) && (
                          <div className="p-2 space-y-1.5 bg-white dark:bg-gray-900/30">
                            {events.map((event) => {
                              const isRecent = recentPassiveEvents.some(re => re.id === event.id);

                              // Check for unknown personnel (Veri Tabanında Bulunamadı)
                              const eventEntries = scannedEntries[event.id] || [];
                              const hasUnknownPersonnel = eventEntries.some(entry =>
                                entry.citizen.name === 'Veri Tabanında' && entry.citizen.surname === 'Bulunamadı'
                              );

                              // Custom style matching user's image request
                              // Dark mode: darker bg, green border (more visible green-600)
                              const cardClass = isRecent
                                ? "bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-green-600 shadow-sm hover:shadow-md"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-75 hover:opacity-100";

                              return (
                                <div key={event.id} className={`rounded-lg p-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition ${cardClass}`}>
                                  <div className="w-full sm:w-auto">
                                    <h4 className="font-bold text-gray-800 dark:text-white text-xs flex flex-wrap gap-1 items-center">
                                      {event.name}
                                      {isRecent && hasUnknownPersonnel && (
                                        <span className="flex items-center gap-1 text-[10px] bg-[#3f1616] text-red-500 px-2 py-0.5 rounded-full border border-red-900/50 whitespace-nowrap ml-2">
                                          <AlertTriangle size={10} />
                                          Belirsiz Personel
                                        </span>
                                      )}
                                    </h4>

                                    {isRecent ? (
                                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                                        <span className="text-gray-500 dark:text-gray-400">Tamamlandı</span>
                                        <span className="text-gray-300 dark:text-gray-600">•</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-300">
                                          {(scannedEntries[event.id]?.length || event.currentCount)} / {event.targetCount}
                                        </span>

                                        {event.completionDuration && (
                                          <>
                                            <span className="text-gray-300 dark:text-gray-600">•</span>
                                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                              <Clock size={10} />
                                              <span className="font-mono">{event.completionDuration}</span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-[10px] text-gray-400">
                                        Veriler arşivlenmiş (Görmek için Yenile)
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    {isRecent && (
                                      <>
                                        <button
                                          onClick={() => setViewingEvent(event)}
                                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
                                          title="Listeyi Gör"
                                        >
                                          <Eye size={16} />
                                        </button>
                                        {isAdmin && (
                                          <>
                                            <button
                                              onClick={() => handleStartEditEvent(event)}
                                              className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition"
                                              title="Düzenle"
                                            >
                                              <Edit size={16} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                // Reuse the refresh logic for single event? Or just reload all.
                                                // For now, reload all.
                                                const icon = document.getElementById('refresh-icon-spin');
                                                if (icon) {
                                                  icon.classList.add('animate-spin');
                                                  setTimeout(() => icon.classList.remove('animate-spin'), 1000);
                                                }
                                                onRefreshPassiveData(recentPassiveEvents.map(e => e.id));
                                              }}
                                              className="p-1.5 text-blue-400 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200 transition"
                                              title="Verileri Yenile"
                                            >
                                              <RefreshCw size={16} />
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => {
                                          if (confirm('Bu etkinliği silmek istediğinize emin misiniz?')) {
                                            onDeleteEvent(event.id);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition"
                                        title="Sil"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div >
              )
            }
          </>
        ) : (
          /* User List */
          isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2 px-1">
                <span>Toplam {users.length} kullanıcı</span>
              </div>
              {users.map((user) => (
                <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{user.username}</h3>
                      {user.fullName !== user.username && <p className="text-sm text-gray-500 dark:text-gray-400">{user.fullName}</p>}
                    </div>
                    <div className="ml-auto sm:ml-2 flex flex-wrap gap-1">
                      {user.roles.includes(UserRole.ADMIN) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                          YÖNETİCİ
                        </span>
                      )}
                      {user.roles.includes(UserRole.PERSONNEL) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          KULLANICI
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button
                      onClick={() => setEditingUser({ ...user })}
                      className="flex-1 sm:flex-none px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm font-medium flex items-center justify-center gap-2 transition"
                    >
                      <UserCog size={16} /> Düzenle
                    </button>
                    <button
                      onClick={() => setShowPasswordReset(user)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium flex items-center justify-center gap-2 transition"
                    >
                      <Key size={16} /> Şifre
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main >

      {/* Modal: Company Selection */}
      {companySelectEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setCompanySelectEvent(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Şirket Seçimi
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Hangi şirketin denetlemesini yapacaksınız?
            </p>

            <div className="space-y-2">
              {companySelectEvent.companies?.map((company, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onStartAudit(companySelectEvent.id, company.name);
                    setCompanySelectEvent(null);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl transition-all group"
                >
                  <div className="text-left">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {company.name}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      Hedef: {company.count} kişi
                    </div>
                  </div>
                  <Play size={16} className="text-blue-500 group-hover:text-blue-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Event */}
      {
        showEventModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setShowEventModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Edit size={20} className="text-secondary-600 dark:text-secondary-400" />
                {editingEvent ? 'Etkinlik Düzenle' : 'Etkinlik Ekle'}
              </h3>

              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etkinlik İsmi</label>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    placeholder="Galatasaray - Fenerbahçe"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="multiCompany"
                    checked={isMultiCompany}
                    onChange={(e) => {
                      setIsMultiCompany(e.target.checked);
                      if (e.target.checked && companyTargets.length === 0) {
                        setCompanyCountInput(1);
                        setCompanyTargets([{ name: '', count: 0 }]);
                      }
                    }}
                    className="w-4 h-4 text-secondary-600 rounded focus:ring-secondary-500 border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="multiCompany" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    Birden fazla şirket hizmet veriyor mu?
                  </label>
                </div>

                {!isMultiCompany ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hedef Kişi Sayısı</label>
                    <input
                      type="number"
                      value={newEventTarget}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewEventTarget(val === '' ? '' : (parseInt(val) || 0));
                      }}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                      min="1"
                      required={!isMultiCompany}
                    />
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Şirket Sayısı</label>
                      <input
                        type="text"
                        value={companyCountInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCompanyCountInput(val === '' ? ('' as any) : parseInt(val) || 0);
                        }}
                        onBlur={() => {
                          if (companyCountInput === '' || Number(companyCountInput) < 1) setCompanyCountInput(1);
                        }}
                        className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {companyTargets.map((comp, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder={`Şirket ${idx + 1} `}
                              value={comp.name}
                              onChange={(e) => {
                                const newArr = [...companyTargets];
                                newArr[idx] = { ...newArr[idx], name: e.target.value };
                                setCompanyTargets(newArr);
                              }}
                              className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                              required
                            />
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              placeholder="Hedef"
                              min="0"
                              value={comp.count}
                              onChange={(e) => {
                                const newArr = [...companyTargets];
                                newArr[idx] = { ...newArr[idx], count: parseInt(e.target.value) || 0 };
                                setCompanyTargets(newArr);
                              }}
                              className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Hedef:</span>
                      <span className="text-lg font-bold text-secondary-600 dark:text-secondary-400">
                        {companyTargets.reduce((sum, t) => sum + (t.count || 0), 0)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlangıç</label>
                    <input
                      type="datetime-local"
                      value={newEventStart}
                      onChange={(e) => setNewEventStart(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bitiş</label>
                    <input
                      type="datetime-local"
                      value={newEventEnd}
                      onChange={(e) => setNewEventEnd(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-bold py-3 px-4 rounded-lg transition"
                  >
                    {editingEvent ? 'Güncelle' : 'Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal: Add User */}
      {
        showAddUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
              <button onClick={() => setShowAddUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Users size={20} className="text-secondary-600 dark:text-secondary-400" /> Kullanıcı Ekle
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Şifre</label>
                  <input
                    type="text"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Yetki Seviyesi</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserRoles.includes(UserRole.PERSONNEL)}
                        onChange={() => toggleNewUserRole(UserRole.PERSONNEL)}
                        className="w-5 h-5 text-secondary-600 rounded focus:ring-secondary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Kullanıcı</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserRoles.includes(UserRole.ADMIN)}
                        onChange={() => toggleNewUserRole(UserRole.ADMIN)}
                        className="w-5 h-5 text-secondary-600 rounded focus:ring-secondary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Yönetici</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-bold py-3 px-4 rounded-lg transition"
                  >
                    Ekle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal: Edit User Role */}
      {
        editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
              <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <UserCog size={20} className="text-blue-600 dark:text-blue-400" /> Yetki Düzenle
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    disabled
                    className="w-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Yetki Seviyesi</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => toggleEditUserRole(UserRole.PERSONNEL)}
                      className={`flex - 1 py - 3 px - 4 rounded - lg border flex items - center justify - center gap - 2 transition ${editingUser.roles.includes(UserRole.PERSONNEL)
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        } `}
                    >
                      {editingUser.roles.includes(UserRole.PERSONNEL) ? <CheckCircle size={18} /> : <div className="w-4.5 h-4.5 border border-gray-300 rounded" />}
                      Personel
                    </button>

                    <button
                      onClick={() => toggleEditUserRole(UserRole.ADMIN)}
                      className={`flex - 1 py - 3 px - 4 rounded - lg border flex items - center justify - center gap - 2 transition ${editingUser.roles.includes(UserRole.ADMIN)
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        } `}
                    >
                      {editingUser.roles.includes(UserRole.ADMIN) ? <ShieldCheck size={18} /> : <div className="w-4.5 h-4.5 border border-gray-300 rounded" />}
                      Yönetici
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSaveUserRole}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal: Password Reset */}
      {
        showPasswordReset && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
              <button onClick={() => setShowPasswordReset(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Key size={20} className="text-gray-600 dark:text-gray-400" /> Şifre Sıfırla
              </h3>

              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>{showPasswordReset.username}</strong> için yeni şifre belirleyin.
                </p>

                <input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Yeni şifre"
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none"
                />

                <button
                  onClick={handleSavePassword}
                  disabled={!tempPassword}
                  className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
                >
                  Güncelle
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal: Self Password Change */}
      {
        showSelfPasswordChange && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
              <button onClick={() => setShowSelfPasswordChange(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Key size={20} className="text-blue-600 dark:text-blue-400" /> Şifremi Değiştir
              </h3>

              <form onSubmit={handleSaveSelfPassword} className="space-y-4">
                <input
                  type="text"
                  value={selfNewPassword}
                  onChange={(e) => setSelfNewPassword(e.target.value)}
                  placeholder="Yeni şifreniz"
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition"
                >
                  Güncelle
                </button>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal: Scanned List Viewer */}
      {
        viewingEvent && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-t-2xl">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewingEvent.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Katılımcı Listesi</p>
                </div>
                <button
                  onClick={() => setViewingEvent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Statistics Section */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider">İSTATİSTİKLER</h4>
                <div className="flex flex-wrap gap-3">
                  {/* Uncertain Stats */}
                  {(() => {
                    const currentEntries = scannedEntries[viewingEvent.id] || [];
                    const uncertainCount = currentEntries.filter(e => e?.citizen?.name === 'Veri Tabanında' && e?.citizen?.surname === 'Bulunamadı').length;

                    if (uncertainCount > 0) {
                      return (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs sm:text-sm font-medium">
                          <AlertCircle size={14} />
                          <span>Belirsiz</span>
                          <span className="bg-orange-100 dark:bg-orange-800 px-1.5 py-0.5 rounded text-xs font-bold">{uncertainCount}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* User Stats */}
                  {(() => {
                    const currentEntries = scannedEntries[viewingEvent.id] || [];
                    const userStats = currentEntries.reduce((acc, entry) => {
                      if (!entry) return acc;
                      const user = entry.recordedBy || 'Bilinmiyor';
                      acc[user] = (acc[user] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);

                    return Object.entries(userStats).map(([username, count]) => (
                      <div key={username} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-medium">
                        <UserIcon size={14} />
                        <span>{username}</span>
                        <span className="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded text-xs font-bold">{count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-center text-xs sm:text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">NO</th>
                      <th className="px-4 sm:px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">TC</th>
                      <th className="px-4 sm:px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Ad Soyad</th>
                      <th className="hidden sm:table-cell px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Durum</th>
                      <th className="hidden sm:table-cell px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Saat</th>
                      <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">Kaydeden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {scannedEntries[viewingEvent.id]?.map((entry, index) => {
                      if (!entry || !entry.citizen) return null;
                      const status = checkWorkStatus(entry.citizen.validityDate);
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 sm:px-6 py-3 text-gray-500 dark:text-gray-400 text-center">{index + 1}</td>
                          <td className="px-4 sm:px-6 py-3 font-mono text-gray-900 dark:text-gray-200 text-center">{entry.citizen.tc}</td>
                          <td className="px-4 sm:px-6 py-3 font-medium text-gray-900 dark:text-gray-200 text-center">{entry.citizen.name} {entry.citizen.surname}</td>
                          <td className="hidden sm:table-cell px-6 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${status.bg} ${status.color}`}>
                              {status.text}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell px-6 py-3 text-gray-500 dark:text-gray-400 text-center">{entry.timestamp}</td>
                          <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-medium text-center">{entry.recordedBy || '-'}</td>
                        </tr>
                      )
                    })}
                    {(!scannedEntries[viewingEvent.id] || scannedEntries[viewingEvent.id].length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                          Henüz kayıt bulunmamaktadır.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end">
                <button
                  onClick={handleExportExcel}
                  disabled={!scannedEntries[viewingEvent.id] || scannedEntries[viewingEvent.id].length === 0}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={18} /> Excel'e Aktar
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default AdminDashboard;