import React, { useState, useEffect, useRef } from 'react';
import { Event, User, UserRole, ScanEntry, Company } from '../types';
import { Plus, Users, Calendar, Play, LogOut, Eye, Trash2, Edit, UserCog, Key, ShieldCheck, User as UserIcon, Activity, Archive, Download, RefreshCw, Clock, X, CheckCircle, Sun, Moon, AlertCircle, ChevronDown, Folder, Upload } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  events: Event[];
  users: User[];
  scannedEntries: Record<string, ScanEntry[]>;
  onLogout: () => void;
  onStartAudit: (eventId: string, companyId?: string) => void;
  onAddEvent: (event: Event) => void;
  onDeleteEvent: (id: string) => void;
  onReactivateEvent: (id: string) => void;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateEvent: (event: Event) => void;
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
  onDeleteUser,
  onUpdateEvent,
  isDarkMode,
  onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'USERS'>('EVENTS');
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);

  // New Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [newEventTarget, setNewEventTarget] = useState(50);
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [hasMultipleCompanies, setHasMultipleCompanies] = useState(false);
  const [numberOfCompanies, setNumberOfCompanies] = useState(1);
  const [newEventCompanies, setNewEventCompanies] = useState<Company[]>([]);

  // Edit Event Form State
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventName, setEditEventName] = useState('');
  const [editEventTarget, setEditEventTarget] = useState(0);
  const [editEventStart, setEditEventStart] = useState('');
  const [editEventEnd, setEditEventEnd] = useState('');
  const [editHasMultipleCompanies, setEditHasMultipleCompanies] = useState(false);
  const [editNumberOfCompanies, setEditNumberOfCompanies] = useState(1);
  const [editEventCompanies, setEditEventCompanies] = useState<Company[]>([]);

  // User Management State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Self Password Change State
  const [showSelfPasswordChange, setShowSelfPasswordChange] = useState(false);
  const [selfNewPassword, setSelfNewPassword] = useState('');

  // Temp state for user forms
  const [tempPassword, setTempPassword] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<UserRole[]>([UserRole.PERSONNEL]);

  // Passive Events Accordion State
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Version Changelog State
  const [showChangelog, setShowChangelog] = useState(false);

  // Company Selection Modal State
  const [showCompanySelectionModal, setShowCompanySelectionModal] = useState(false);
  const [selectedEventForCompany, setSelectedEventForCompany] = useState<Event | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Excel Upload for Bulk Event Creation
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

  // ESC key handler for closing viewingEvent modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && viewingEvent) {
        setViewingEvent(null);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [viewingEvent]);

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

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();

    // Şirketler varsa toplam hedefi hesapla
    const finalTargetCount = hasMultipleCompanies && newEventCompanies.length > 0
      ? newEventCompanies.reduce((sum, company) => sum + company.targetCount, 0)
      : newEventTarget;

    const newEvent: Event = {
      id: Date.now().toString(),
      name: newEventName,
      targetCount: finalTargetCount,
      currentCount: 0,
      startDate: newEventStart,
      endDate: newEventEnd,
      status: 'ACTIVE',
      companies: hasMultipleCompanies && newEventCompanies.length > 0 ? newEventCompanies : undefined
    };
    onAddEvent(newEvent);
    setShowEventModal(false);
    // Reset form
    setNewEventName('');
    setNewEventTarget(50);
    setNewEventStart('');
    setNewEventEnd('');
    setHasMultipleCompanies(false);
    setNumberOfCompanies(1);
    setNewEventCompanies([]);
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

  const openEditEventModal = (event: Event) => {
    setEditingEvent(event);
    setEditEventName(event.name);
    setEditEventTarget(event.targetCount);

    // ISO string'i datetime-local input formatına çevir (YYYY-MM-DDTHH:mm)
    const formatDateForInput = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEditEventStart(formatDateForInput(event.startDate));
    setEditEventEnd(formatDateForInput(event.endDate));

    // Şirket bilgilerini yükle
    if (event.companies && event.companies.length > 0) {
      setEditHasMultipleCompanies(true);
      setEditNumberOfCompanies(event.companies.length);
      setEditEventCompanies(event.companies);
    } else {
      setEditHasMultipleCompanies(false);
      setEditNumberOfCompanies(1);
      setEditEventCompanies([]);
    }
  };

  const handleUpdateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    // Şirketler varsa toplam hedefi hesapla
    const finalTargetCount = editHasMultipleCompanies && editEventCompanies.length > 0
      ? editEventCompanies.reduce((sum, company) => sum + company.targetCount, 0)
      : editEventTarget;

    const updatedEvent: Event = {
      ...editingEvent,
      name: editEventName,
      targetCount: finalTargetCount,
      startDate: editEventStart,
      endDate: editEventEnd,
      companies: editHasMultipleCompanies && editEventCompanies.length > 0 ? editEventCompanies : undefined
    };

    onUpdateEvent(updatedEvent);
    setEditingEvent(null);
    // Reset edit form
    setEditHasMultipleCompanies(false);
    setEditNumberOfCompanies(1);
    setEditEventCompanies([]);
  };

  const handleDeleteClick = (event: Event) => {
    const actualCount = scannedEntries[event.id]?.length || 0;
    if (actualCount > 0) {
      setEventToDelete(event);
    } else {
      onDeleteEvent(event.id);
    }
  };

  const confirmDeleteEvent = () => {
    if (eventToDelete) {
      onDeleteEvent(eventToDelete.id);
      setEventToDelete(null);
    }
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      onDeleteUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  const handleStartAuditClick = (eventId: string) => {
    const event = events.find(e => e.id === eventId);

    // Eğer etkinlikte şirketler varsa, önce şirket seçimi yap
    if (event?.companies && event.companies.length > 0) {
      setSelectedEventForCompany(event);
      setShowCompanySelectionModal(true);
    } else {
      // Şirket yoksa direkt başlat
      onStartAudit(eventId);
    }
  };

  const handleCompanySelection = (companyId: string) => {
    if (selectedEventForCompany) {
      onStartAudit(selectedEventForCompany.id, companyId);
      setShowCompanySelectionModal(false);
      setSelectedEventForCompany(null);
      setSelectedCompanyId(null);
    }
  };

  const checkWorkStatus = (dateStr: string) => {
    if (!dateStr || dateStr === '-' || dateStr.trim() === '') {
      return { text: 'BELİRSİZ', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300' };
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
    XLSX.writeFile(wb, `${viewingEvent.name}_Katilimci_Listesi.xlsx`);
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

  const continuingEvents = events.filter(e => e.status === 'ACTIVE' && (scannedEntries[e.id]?.length || 0) > 0);
  const activeEvents = events.filter(e => e.status === 'ACTIVE' && (scannedEntries[e.id]?.length || 0) === 0);
  const passiveEvents = events
    .filter(e => e.status === 'PASSIVE')
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

  // Group passive events by month/year
  const groupPassiveEventsByMonth = () => {
    const grouped: Record<string, Event[]> = {};
    passiveEvents.forEach(event => {
      // Try to extract date from event name first
      let dateToUse = new Date(event.endDate); // fallback to endDate

      // Try to find DD.MM.YYYY or DD/MM/YYYY pattern first
      const datePattern = /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/;
      const dateMatch = event.name.match(datePattern);

      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // 0-indexed
        const year = parseInt(dateMatch[3]);
        dateToUse = new Date(year, month, day);
      } else {
        // Try to find month name in name
        const monthNames = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
          'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
        const nameLower = event.name.toLowerCase();

        // Find month in name
        for (let i = 0; i < monthNames.length; i++) {
          if (nameLower.includes(monthNames[i])) {
            // Found a month, try to extract year if present
            const yearMatch = event.name.match(/\b(20\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
            dateToUse = new Date(year, i, 1);
            break;
          }
        }
      }

      const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(event);
    });
    return grouped;
  };

  const groupedPassiveEvents = groupPassiveEventsByMonth();
  const monthKeys = Object.keys(groupedPassiveEvents).sort().reverse(); // Newest first

  // Pasif etkinlik klasörleri varsayılan olarak kapalı gelir
  // Kullanıcı istediği ayı tıklayarak açabilir

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const formatMonthYear = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
  };

  // Handle Excel Upload for Bulk Event Creation
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('📁 Excel file selected:', file.name);

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (event) => {
        console.log('📖 Reading Excel file...');
        const data = event.target?.result;
        // Use cellDates option to auto-convert Excel serial dates to JS Date objects
        // Use raw: true to preserve Date objects (raw: false would convert them to strings)
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true, cellNF: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as any[][];

        console.log(`📊 Total rows in Excel: ${jsonData.length}`);
        console.log(`📊 Processing ${jsonData.length - 1} rows (excluding header)`);

        let createdCount = 0;
        let skippedCount = 0;

        // Skip header row, start from index 1
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];

          // Skip completely empty rows
          if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
            console.log(`⏭️ Row ${i + 1}: Skipped (empty row)`);
            continue; // Don't count empty rows as skipped
          }

          if (row.length < 6) {
            console.log(`⏭️ Row ${i + 1}: Skipped (insufficient columns, has ${row.length} columns, need at least 6)`);
            skippedCount++;
            continue;
          }

          const dateValue = row[0]; // Column 1: Date (can be Date object, number, or DD.MM.YYYY string)
          const timeRange = row[1]?.toString().trim(); // Column 2: Time range (HH:MM-HH:MM)
          const eventName = row[2]?.toString().trim(); // Column 3: Event name
          const targetCount = parseInt(row[5]?.toString().trim() || '0'); // Column 6: Target count

          console.log(`📝 Row ${i + 1}:`, {
            dateValue: dateValue,
            dateType: typeof dateValue,
            timeRange,
            eventName,
            targetCount,
            rawRow: row
          });

          // More detailed validation
          const validationErrors = [];
          if (!dateValue || dateValue === null || dateValue === '') validationErrors.push('tarih eksik');
          if (!timeRange || timeRange === '') validationErrors.push('saat aralığı eksik');
          if (!eventName || eventName === '') validationErrors.push('etkinlik adı eksik');
          if (!targetCount || targetCount === 0 || isNaN(targetCount)) validationErrors.push('hedef sayı eksik veya geçersiz');

          if (validationErrors.length > 0) {
            console.log(`⏭️ Row ${i + 1}: Skipped - ${validationErrors.join(', ')}`);
            skippedCount++;
            continue;
          }

          // Parse date - handle multiple formats
          let eventDate: Date | null = null;

          console.log(`🔍 Row ${i + 1} - Parsing date:`, {
            value: dateValue,
            type: typeof dateValue,
            isDate: dateValue instanceof Date
          });

          // If it's already a Date object (from XLSX cellDates: true)
          if (dateValue instanceof Date) {
            // Excel Date objelerinde timezone sorunu olabiliyor, UTC kullanarak doğru tarihi alıyoruz
            const year = dateValue.getUTCFullYear();
            const month = dateValue.getUTCMonth();
            const day = dateValue.getUTCDate();
            // Tarihi local timezone'da oluştur (saat 00:00:00)
            eventDate = new Date(year, month, day, 0, 0, 0, 0);
            console.log(`✅ Row ${i + 1} - Date parsed as Date object (UTC):`, {
              original: dateValue.toISOString(),
              parsed: eventDate.toString(),
              display: `${day}.${month + 1}.${year}`
            });
          }
          // If it's a number (Excel serial date), convert it
          else if (typeof dateValue === 'number') {
            // Excel serial date: days since 1900-01-01 (Excel'in tarihi)
            // Excel'de 1 = 1900-01-01, ancak Excel'de 1900'ü yanlışlıkla artık yıl kabul ettiği için düzeltme gerekiyor
            const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30 (Excel epoch için doğru başlangıç)
            const tempDate = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
            // UTC değerlerini kullanarak timezone sorununu önle
            const year = tempDate.getUTCFullYear();
            const month = tempDate.getUTCMonth();
            const day = tempDate.getUTCDate();
            // Tarihi local timezone'da oluştur (saat 00:00:00)
            eventDate = new Date(year, month, day, 0, 0, 0, 0);
            console.log(`✅ Row ${i + 1} - Date parsed from Excel serial (${dateValue}):`, {
              serial: dateValue,
              utcDate: tempDate.toISOString(),
              parsed: eventDate.toString(),
              display: `${day}.${month + 1}.${year}`
            });
          }
          // If it's a string (DD.MM.YYYY format)
          else if (typeof dateValue === 'string') {
            const dateStr = dateValue.trim();
            console.log(`🔍 Row ${i + 1} - Parsing string date:`, dateStr);
            const dateParts = dateStr.split('.');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1;
              const year = parseInt(dateParts[2]);
              // Tarihi local timezone'da oluştur (saat 00:00:00)
              eventDate = new Date(year, month, day, 0, 0, 0, 0);
              console.log(`✅ Row ${i + 1} - Date parsed from string (${dateStr}):`, eventDate.toString());
            } else {
              console.log(`❌ Row ${i + 1} - Invalid string date format (expected DD.MM.YYYY):`, dateStr);
            }
          } else {
            console.log(`❌ Row ${i + 1} - Unknown date type:`, typeof dateValue);
          }

          if (!eventDate || isNaN(eventDate.getTime())) {
            console.log(`⏭️ Row ${i + 1}: Skipped (invalid date - parsed value:`, eventDate, ')');
            skippedCount++;
            continue;
          }

          // Parse time range (HH:MM-HH:MM)
          const times = timeRange.split('-');
          if (times.length !== 2) {
            console.log(`⏭️ Row ${i + 1}: Skipped (invalid time format - expected HH:MM-HH:MM, got: ${timeRange})`);
            skippedCount++;
            continue;
          }
          const startTime = times[0].trim();
          const endTime = times[1].trim();

          // Validate time format
          const timePattern = /^\d{1,2}:\d{2}$/;
          if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
            console.log(`⏭️ Row ${i + 1}: Skipped (invalid time format - start: ${startTime}, end: ${endTime})`);
            skippedCount++;
            continue;
          }

          // Create start and end dates
          const startDate = new Date(eventDate);
          const [startHour, startMin] = startTime.split(':').map(Number);
          startDate.setHours(startHour, startMin, 0, 0);

          const endDate = new Date(eventDate);
          const [endHour, endMin] = endTime.split(':').map(Number);
          endDate.setHours(endHour, endMin, 0, 0);

          // Format date for event name (DD.MM.YYYY)
          const day = eventDate.getDate().toString().padStart(2, '0');
          const month = (eventDate.getMonth() + 1).toString().padStart(2, '0');
          const year = eventDate.getFullYear();
          const formattedDate = `${day}.${month}.${year}`;

          // Create event name with date prefix
          const eventNameWithDate = `${formattedDate} - ${eventName}`;

          // Create event
          const newEvent: Event = {
            id: `event_${Date.now()}_${i}`,
            name: eventNameWithDate,
            targetCount: targetCount,
            currentCount: 0,
            status: 'ACTIVE',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          };

          console.log(`✅ Row ${i + 1} - Creating event:`, newEvent);

          try {
            await onAddEvent(newEvent);
            console.log(`✅ Row ${i + 1} - Event created successfully: ${eventName}`);
            createdCount++;
          } catch (err) {
            console.error(`❌ Row ${i + 1} - Error creating event ${eventName}:`, err);
            skippedCount++; // Count as skipped if creation fails
          }

          // Small delay to avoid overwhelming Firebase
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`\n🎉 Upload complete!\n📊 Created: ${createdCount}\n⏭️ Skipped: ${skippedCount}`);
        alert(`Etkinlikler başarıyla yüklendi!\n\nOluşturulan: ${createdCount}\nAtlanan: ${skippedCount}`);
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('❌ Excel upload error:', error);
      alert('Excel yüklenirken hata oluştu.');
    }

    // Reset file input
    if (excelFileInputRef.current) {
      excelFileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Etkinlik Sistemi</h1>
            <span className="bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase">
              {isAdmin ? 'Yönetici' : 'Kullanıcı'}
            </span>
            <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase border border-green-200 dark:border-green-800 animate-pulse">
              Canlı
            </span>
            <button
              onClick={() => setShowChangelog(true)}
              className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition cursor-pointer"
              title="Değişiklik Günlüğü"
            >
              v1.1.0
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5 truncate max-w-[120px] sm:max-w-none">
              <UserIcon size={14} />
              {currentUser.fullName}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={onToggleTheme}
                className="px-1.5 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title="Tema Değiştir"
              >
                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                onClick={() => setShowSelfPasswordChange(true)}
                className="px-1.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                title="Şifre Değiştir"
              >
                <Key size={14} />
              </button>
              <button
                onClick={onLogout}
                className="px-1.5 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                title="Çıkış"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 py-4">

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
            {activeTab === 'EVENTS' ? 'Aktif Denetimler' : 'Sistem Kullanıcıları'}
          </h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('EVENTS')}
                  className={`flex-1 sm:flex-none px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border ${activeTab === 'EVENTS' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white' : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Calendar size={14} /> Etkinlik
                </button>
                <button
                  onClick={() => setActiveTab('USERS')}
                  className={`flex-1 sm:flex-none px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border ${activeTab === 'USERS' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white' : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Users size={14} /> Kullanıcı
                </button>
              </>
            )}

            {isAdmin && activeTab === 'EVENTS' && (
              <>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-secondary-600 text-white rounded-lg text-xs font-medium hover:bg-secondary-700 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Ekle
                </button>
                <button
                  onClick={() => excelFileInputRef.current?.click()}
                  className="flex-1 sm:flex-none px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 shadow-sm flex items-center justify-center gap-1.5"
                  title="Excel'den Toplu Etkinlik Yükle"
                >
                  <Upload size={14} /> Excel Yükle
                </button>
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </>
            )}

            {isAdmin && activeTab === 'USERS' && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex-1 sm:flex-none px-2 py-1.5 bg-secondary-600 text-white rounded-lg text-xs font-medium hover:bg-secondary-700 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Ekle
              </button>
            )}
          </div>
        </div>

        {activeTab === 'EVENTS' ? (
          <>
            {/* Active Event List */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 mb-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Aktif Etkinlikler ({activeEvents.length})</h3>
              </div>
              {activeEvents.map((event) => {
                const now = new Date();
                let start = new Date();
                try {
                  start = event.startDate ? new Date(event.startDate) : new Date();
                } catch (e) { console.warn('Date parse error', e) }
                const actualCount = scannedEntries[event.id]?.length || 0;
                const isOverdueAndEmpty = event.startDate && now > start && actualCount === 0;

                return (
                  <div key={event.id} className={`rounded-lg border p-3 shadow-sm hover:shadow-md transition ${isOverdueAndEmpty ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white break-words">{event.name}</h3>
                            {isOverdueAndEmpty && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800 uppercase tracking-wide">
                                Veri Girişi Yok
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${isOverdueAndEmpty ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'}`}>
                              <Clock size={10} />
                              {formatDate(event.startDate)}
                            </div>
                            <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              <Clock size={10} />
                              {formatDate(event.endDate)}
                            </div>
                          </div>
                          {isOverdueAndEmpty && (
                            <p className="mt-1.5 text-[10px] text-red-600 dark:text-red-400 font-medium">
                              ! Etkinlik süresi başladı ancak henüz okutma yapılmadı.
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Hedef: {event.targetCount}</span>
                            <span>•</span>
                            <span className={actualCount >= event.targetCount ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                              {actualCount} / {event.targetCount}
                            </span>
                          </div>
                          {/* Progress Bar in Card */}
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1 mt-1.5 max-w-xs">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-1 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (actualCount / event.targetCount) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleStartAuditClick(event.id)}
                            className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition"
                            title="Denetimi Başlat"
                          >
                            <Play size={16} className="fill-current" />
                          </button>
                          <button
                            onClick={() => setViewingEvent(event)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition"
                            title="Listeyi Gör"
                          >
                            <Eye size={16} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditEventModal(event)}
                                className="p-2 text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition"
                                title="Düzenle"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(event)}
                                className="p-2 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {activeEvents.length === 0 && (
                <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-dashed">
                  <Calendar className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-2 text-xs font-medium text-gray-900 dark:text-white">Aktif Etkinlik Yok</h3>
                  {isAdmin && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Yeni bir etkinlik oluşturarak başlayın.</p>}
                </div>
              )}
            </div>

            {/* Continuing Audits Section */}
            {continuingEvents.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-1.5 mb-3">
                  <Activity className="text-green-600 dark:text-green-400" size={16} />
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">Devam Eden ({continuingEvents.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {continuingEvents.map(event => (
                    <div
                      key={event.id}
                      className="relative bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 p-3 rounded-lg shadow-sm hover:shadow-md hover:border-green-400 dark:hover:border-green-600 transition text-left group w-full"
                    >
                      {/* Actions (Absolute top-right) */}
                      {isAdmin && (
                        <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEventModal(event);
                            }}
                            className="p-1.5 bg-white/50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 rounded-lg transition"
                            title="Etkinliği Düzenle"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(event);
                            }}
                            className="p-1.5 bg-white/50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded-lg transition"
                            title="Etkinliği Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <div onClick={() => handleStartAuditClick(event.id)} className="cursor-pointer">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400 truncate pr-8">{event.name}</h4>
                        <div className="mt-1.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Doluluk</span>
                          <span className="font-mono">{scannedEntries[event.id]?.length || 0} / {event.targetCount}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1 mt-1.5">
                          <div
                            className="bg-green-500 h-1 rounded-full"
                            style={{ width: `${Math.min(100, ((scannedEntries[event.id]?.length || 0) / event.targetCount) * 100)}%` }}
                          ></div>
                        </div>

                        {/* Company Stats (if companies exist) */}
                        {event.companies && event.companies.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <h5 className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                              Şirket Bazlı
                            </h5>
                            {event.companies.map((company, idx) => {
                              const companyScans = scannedEntries[event.id]?.filter(
                                entry => entry.companyId === company.id
                              ) || [];
                              const companyCount = companyScans.length;
                              const companyPercentage = Math.round((companyCount / company.targetCount) * 100);

                              return (
                                <div key={company.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-2 rounded-lg">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1">
                                      <span className="bg-secondary-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                                        {company.name}
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                                      {companyCount}/{company.targetCount} ({companyPercentage}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-0.5">
                                    <div
                                      className="bg-green-500 h-0.5 rounded-full transition-all"
                                      style={{ width: `${Math.min(100, companyPercentage)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* User Stats for Continuing Events */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(scannedEntries[event.id]?.reduce((acc, entry) => {
                            acc[entry.recordedBy] = (acc[entry.recordedBy] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>) || {}).map(([user, count]) => (
                            <span key={user} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                              <UserIcon size={9} /> {user}: {count}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                          <Play size={10} className="fill-current" />
                          Denetime Devam Et
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Passive Events Section - Only Visible to Admins */}
            {isAdmin && passiveEvents.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Archive className="text-gray-500 dark:text-gray-400" size={20} />
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Pasif Etkinlikler ({passiveEvents.length})</h3>
                </div>
                <div className="space-y-2">
                  {monthKeys.map(monthKey => {
                    const monthEvents = groupedPassiveEvents[monthKey];
                    const isExpanded = expandedMonths.has(monthKey);

                    return (
                      <div key={monthKey} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        {/* Month Header - Clickable */}
                        <button
                          onClick={() => toggleMonth(monthKey)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                        >
                          <div className="flex items-center gap-3">
                            <Folder className="text-gray-400 dark:text-gray-500" size={20} />
                            <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize">
                              {formatMonthYear(monthKey)}
                            </span>
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                              {monthEvents.length}
                            </span>
                          </div>
                          <ChevronDown
                            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            size={20}
                          />
                        </button>

                        {/* Month Events - Collapsible */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                            <div className="p-3 space-y-2">
                              {monthEvents.map(event => (
                                <div key={event.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div className="w-full sm:w-auto">
                                    <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300">{event.name}</h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Tamamlandı • {scannedEntries[event.id]?.length || 0}/{event.targetCount}</p>
                                      {event.completionDuration && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono flex items-center gap-1 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                          <Clock size={10} /> {event.completionDuration}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button
                                      onClick={() => setViewingEvent(event)}
                                      className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                      title="Listeyi Gör"
                                    >
                                      <Eye size={18} />
                                    </button>
                                    {isAdmin && (
                                      <>
                                        <button
                                          onClick={() => openEditEventModal(event)}
                                          className="p-2 text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          title="Etkinliği Düzenle"
                                        >
                                          <Edit size={18} />
                                        </button>
                                        <button
                                          onClick={() => onReactivateEvent(event.id)}
                                          className="p-2 text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          title="Denetimi Tekrar Aktif Et"
                                        >
                                          <RefreshCw size={18} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteClick(event)}
                                          className="p-2 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                          title="Etkinliği Sil"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                    {user.id !== currentUser.id && (
                      <button
                        onClick={() => setUserToDelete(user)}
                        className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-medium flex items-center justify-center gap-2 transition"
                        title="Kullanıcıyı Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>



      {/* Modal: User Delete Confirmation */}
      {
        userToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Emin misiniz?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                <strong>{userToDelete.username}</strong> kullanıcısı silinecek. Bu işlem geri alınamaz.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  İptal
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal: Delete Confirmation */}
      {
        eventToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Emin misiniz?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                <strong>{eventToDelete.name}</strong> etkinliğinde kayıtlı okutmalar mevcut. Silerseniz bu veriler kaybolabilir.
                <br /><br />
                Denetleme başladı, silmeye emin misin?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  İptal
                </button>
                <button
                  onClick={confirmDeleteEvent}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal: Edit Event */}
      {
        editingEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setEditingEvent(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Edit size={20} className="text-secondary-600 dark:text-secondary-400" /> Etkinliği Düzenle
              </h3>

              <form onSubmit={handleUpdateEventSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etkinlik İsmi</label>
                  <input
                    type="text"
                    value={editEventName}
                    onChange={(e) => setEditEventName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    placeholder="Galatasaray - Fenerbahçe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hedef Kişi Sayısı</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editEventTarget || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setEditEventTarget(value ? parseInt(value) : 0);
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    placeholder="Örn: 50"
                    required={!editHasMultipleCompanies}
                    disabled={editHasMultipleCompanies}
                  />
                  {editHasMultipleCompanies && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Toplam hedef şirketlere göre otomatik hesaplanacak
                    </p>
                  )}
                </div>

                {/* Farklı Şirket Var mı? */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHasMultipleCompanies}
                      onChange={(e) => {
                        setEditHasMultipleCompanies(e.target.checked);
                        if (!e.target.checked) {
                          setEditEventCompanies([]);
                          setEditNumberOfCompanies(1);
                        }
                      }}
                      className="w-4 h-4 text-secondary-600 border-gray-300 rounded focus:ring-secondary-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Farklı şirketler var mı?
                    </span>
                  </label>
                </div>

                {/* Şirket Sayısı */}
                {editHasMultipleCompanies && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Kaç Şirket Var?
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editNumberOfCompanies || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value === '') {
                          setEditNumberOfCompanies(0);
                          setEditEventCompanies([]);
                          return;
                        }
                        let count = parseInt(value);
                        count = Math.min(Math.max(count, 1), 10);
                        setEditNumberOfCompanies(count);
                        const updatedCompanies = Array.from({ length: count }, (_, index) => ({
                          id: editEventCompanies[index]?.id || `company_${Date.now()}_${index}`,
                          name: editEventCompanies[index]?.name || '',
                          targetCount: editEventCompanies[index]?.targetCount || 0
                        }));
                        setEditEventCompanies(updatedCompanies);
                      }}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                      placeholder="1-10 arası"
                      required
                    />
                  </div>
                )}

                {/* Şirket Detayları */}
                {editHasMultipleCompanies && editEventCompanies.length > 0 && (
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 max-h-96 overflow-y-auto">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Şirket Detayları
                    </h4>
                    {editEventCompanies.map((company, index) => (
                      <div key={company.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-secondary-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Şirket {index + 1}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Şirket İsmi
                          </label>
                          <input
                            type="text"
                            value={company.name}
                            onChange={(e) => {
                              const updated = [...editEventCompanies];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setEditEventCompanies(updated);
                            }}
                            className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                            placeholder={`Şirket ${index + 1} adı`}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Hedef Kişi Sayısı
                          </label>
                          <input
                            type="number"
                            value={company.targetCount}
                            onChange={(e) => {
                              const updated = [...editEventCompanies];
                              updated[index] = { ...updated[index], targetCount: parseInt(e.target.value) || 0 };
                              setEditEventCompanies(updated);
                            }}
                            className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                            min="1"
                            placeholder="Hedef sayı"
                            required
                          />
                        </div>
                      </div>
                    ))}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-xs sticky bottom-0">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        Toplam Hedef: {editEventCompanies.reduce((sum, c) => sum + (c.targetCount || 0), 0)} kişi
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlangıç</label>
                    <input
                      type="datetime-local"
                      value={editEventStart}
                      onChange={(e) => setEditEventStart(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bitiş</label>
                    <input
                      type="datetime-local"
                      value={editEventEnd}
                      onChange={(e) => setEditEventEnd(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-bold py-3 px-4 rounded-lg transition"
                  >
                    Güncelle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal: Company Selection */}
      {
        showCompanySelectionModal && selectedEventForCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button
                onClick={() => {
                  setShowCompanySelectionModal(false);
                  setSelectedEventForCompany(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Şirket Seçimi
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Hangi şirket için denetim başlatmak istiyorsunuz?
              </p>

              <div className="space-y-3">
                {selectedEventForCompany.companies?.map((company, index) => {
                  const companyScans = scannedEntries[selectedEventForCompany.id]?.filter(
                    entry => entry.companyId === company.id
                  ) || [];
                  const currentCount = companyScans.length;
                  const percentage = Math.round((currentCount / company.targetCount) * 100);

                  return (
                    <button
                      key={company.id}
                      onClick={() => handleCompanySelection(company.id)}
                      className="w-full bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 p-4 rounded-xl transition text-left group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-secondary-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {index + 1}
                          </span>
                          <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {company.name}
                          </h4>
                        </div>
                        <Play size={20} className="text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition fill-current" />
                      </div>

                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>Hedef: {company.targetCount}</span>
                        <span className="font-mono">{currentCount} / {company.targetCount} ({percentage}%)</span>
                      </div>

                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        ></div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setShowCompanySelectionModal(false);
                  setSelectedEventForCompany(null);
                }}
                className="w-full mt-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                İptal
              </button>
            </div>
          </div>
        )
      }

      {/* Modal: Add Event */}
      {
        showEventModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setShowEventModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Edit size={20} className="text-secondary-600 dark:text-secondary-400" /> Etkinlik Ekle
              </h3>

              <form onSubmit={handleCreateEvent} className="space-y-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hedef Kişi Sayısı</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newEventTarget || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setNewEventTarget(value ? parseInt(value) : 0);
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    placeholder="Örn: 50"
                    required={!hasMultipleCompanies}
                    disabled={hasMultipleCompanies}
                  />
                  {hasMultipleCompanies && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Toplam hedef şirketlere göre otomatik hesaplanacak
                    </p>
                  )}
                </div>

                {/* Farklı Şirket Var mı? */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasMultipleCompanies}
                      onChange={(e) => {
                        setHasMultipleCompanies(e.target.checked);
                        if (!e.target.checked) {
                          setNewEventCompanies([]);
                          setNumberOfCompanies(1);
                        }
                      }}
                      className="w-4 h-4 text-secondary-600 border-gray-300 rounded focus:ring-secondary-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Farklı şirketler var mı?
                    </span>
                  </label>
                </div>

                {/* Şirket Sayısı Girişi */}
                {hasMultipleCompanies && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Kaç Şirket Var?
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={numberOfCompanies || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value === '') {
                          setNumberOfCompanies(0);
                          setNewEventCompanies([]);
                          return;
                        }
                        let count = parseInt(value);
                        count = Math.min(Math.max(count, 1), 10);
                        setNumberOfCompanies(count);
                        // Mevcut şirketleri koru, eksik olanları ekle
                        const updatedCompanies = Array.from({ length: count }, (_, index) => ({
                          id: `company_${Date.now()}_${index}`,
                          name: newEventCompanies[index]?.name || '',
                          targetCount: newEventCompanies[index]?.targetCount || 0
                        }));
                        setNewEventCompanies(updatedCompanies);
                      }}
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                      placeholder="1-10 arası"
                      required
                    />
                  </div>
                )}

                {/* Şirket Detayları */}
                {hasMultipleCompanies && newEventCompanies.length > 0 && (
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 max-h-96 overflow-y-auto">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Şirket Detayları
                    </h4>
                    {newEventCompanies.map((company, index) => (
                      <div key={company.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-secondary-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Şirket {index + 1}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Şirket İsmi
                          </label>
                          <input
                            type="text"
                            value={company.name}
                            onChange={(e) => {
                              const updated = [...newEventCompanies];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setNewEventCompanies(updated);
                            }}
                            className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                            placeholder={`Şirket ${index + 1} adı`}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Hedef Kişi Sayısı
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={company.targetCount || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              const updated = [...newEventCompanies];
                              updated[index] = { ...updated[index], targetCount: value ? parseInt(value) : 0 };
                              setNewEventCompanies(updated);
                            }}
                            className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-secondary-500 outline-none"
                            placeholder="Hedef sayı"
                            required
                          />
                        </div>
                      </div>
                    ))}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-xs sticky bottom-0">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        Toplam Hedef: {newEventCompanies.reduce((sum, c) => sum + (c.targetCount || 0), 0)} kişi
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
                    Oluştur
                  </button>
                </div>
              </form>
            </div>
          </div >
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
                      className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition ${editingUser.roles.includes(UserRole.PERSONNEL)
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                      {editingUser.roles.includes(UserRole.PERSONNEL) ? <CheckCircle size={18} /> : <div className="w-4.5 h-4.5 border border-gray-300 rounded" />}
                      Personel
                    </button>

                    <button
                      onClick={() => toggleEditUserRole(UserRole.ADMIN)}
                      className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition ${editingUser.roles.includes(UserRole.ADMIN)
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
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
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setViewingEvent(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
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



              <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">İstatistikler</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Uncertain Status Count */}
                  {(() => {
                    const uncertainCount = (scannedEntries[viewingEvent.id] || []).filter(entry =>
                      checkWorkStatus(entry.citizen.validityDate).text === 'BELİRSİZ'
                    ).length;

                    if (uncertainCount > 0) {
                      return (
                        <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg text-xs font-medium border border-orange-100 dark:border-orange-800 flex items-center gap-2">
                          <AlertCircle size={12} />
                          <span>Belirsiz</span>
                          <span className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-md shadow-sm border border-orange-100 dark:border-orange-800 text-orange-800 dark:text-orange-200 font-bold">
                            {uncertainCount}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {Object.entries(scannedEntries[viewingEvent.id]?.reduce((acc, entry) => {
                    acc[entry.recordedBy] = (acc[entry.recordedBy] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>) || {}).map(([registrar, count]) => (
                    <div key={registrar} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium border border-blue-100 dark:border-blue-800 flex items-center gap-2">
                      <UserIcon size={12} />
                      <span>{registrar}</span>
                      <span className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-md shadow-sm border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200 font-bold">
                        {count}
                      </span>
                    </div>
                  ))}

                  {(!scannedEntries[viewingEvent.id] || scannedEntries[viewingEvent.id].length === 0) && (
                    <span className="text-xs text-gray-400 italic">Veri bulunamadı</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 font-medium text-gray-500 dark:text-gray-400">NO</th>
                      <th className="px-4 sm:px-6 py-3 font-medium text-gray-500 dark:text-gray-400">TC</th>
                      <th className="px-4 sm:px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Ad Soyad</th>
                      <th className="hidden sm:table-cell px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Durum</th>
                      <th className="hidden sm:table-cell px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Saat</th>
                      <th className="hidden sm:table-cell px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Kaydeden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {scannedEntries[viewingEvent.id]?.map((entry, index) => {
                      const status = checkWorkStatus(entry.citizen.validityDate);
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 sm:px-6 py-3 text-gray-500 dark:text-gray-400">{index + 1}</td>
                          <td className="px-4 sm:px-6 py-3 font-mono text-gray-900 dark:text-gray-200">{entry.citizen.tc}</td>
                          <td className="px-4 sm:px-6 py-3 font-medium text-gray-900 dark:text-gray-200">{entry.citizen.name} {entry.citizen.surname}</td>
                          <td className="hidden sm:table-cell px-6 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${status.bg} ${status.color}`}>
                              {status.text}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell px-6 py-3 text-gray-500 dark:text-gray-400">{entry.timestamp}</td>
                          <td className="hidden sm:table-cell px-6 py-3 text-gray-500 dark:text-gray-400">{entry.recordedBy}</td>
                        </tr>
                      )
                    })}
                    {(!scannedEntries[viewingEvent.id] || scannedEntries[viewingEvent.id].length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
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

      {/* Version Changelog Modal */}
      {
        showChangelog && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="text-white">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle size={24} />
                    Versiyon 1.1.0 - Yenilikler
                  </h2>
                  <p className="text-sm text-blue-100 mt-1">Aralık 2025</p>
                </div>
                <button
                  onClick={() => setShowChangelog(false)}
                  className="text-white/80 hover:text-white transition p-2 hover:bg-white/10 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                <div className="space-y-6">
                  {/* New Features */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <CheckCircle className="text-green-500" size={20} />
                      Yeni Özellikler
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span><strong>Ay Bazlı Gruplama:</strong> Pasif etkinlikler artık ay/yıl klasörlerinde gruplandırılıyor</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span><strong>Akordeon UI:</strong> Her ay için açılır/kapanır menü ve etkinlik sayısı gösterimi</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span><strong>Tarih Algılama:</strong> Etkinlik isimlerindeki tarihler (DD.MM.YYYY) otomatik algılanıyor</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span><strong>Otomatik Tamamlama:</strong> Hedefe ulaşan etkinlikler çıkışta otomatik PASSIVE oluyor</span>
                      </li>
                    </ul>
                  </div>

                  {/* Improvements */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Activity className="text-blue-500" size={20} />
                      İyileştirmeler
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span><strong>Modal Kapatma:</strong> ESC tuşu ve backdrop tıklama ile modal kapatma</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span><strong>Dinamik Sayım:</strong> Pasif etkinlik sayıları gerçek veri üzerinden hesaplanıyor</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span><strong>Sıralama:</strong> Pasif etkinlikler yeni tarihten eskiye doğru sıralı</span>
                      </li>
                    </ul>
                  </div>

                  {/* Bug Fixes */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <AlertCircle className="text-orange-500" size={20} />
                      Hata Düzeltmeleri
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">→</span>
                        <span>Geçmiş denetleme doğrulama hatası düzeltildi</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">→</span>
                        <span>Pasif etkinlik sayaç senkronizasyon sorunu çözüldü</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <button
                  onClick={() => setShowChangelog(false)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-2.5 px-6 rounded-xl transition"
                >
                  Kapat
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