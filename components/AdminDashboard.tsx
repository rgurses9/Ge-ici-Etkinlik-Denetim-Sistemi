import React, { useState } from 'react';
import { Event, User, UserRole, ScanEntry } from '../types';
import { Plus, Users, Calendar, Play, LogOut, Eye, Trash2, Edit, UserCog, Key, ShieldCheck, User as UserIcon, Activity, Archive, Download, RefreshCw, Clock, X, CheckCircle, Sun, Moon } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  events: Event[];
  users: User[];
  scannedEntries: Record<string, ScanEntry[]>;
  onLogout: () => void;
  onStartAudit: (eventId: string) => void;
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

  // Edit Event Form State
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventName, setEditEventName] = useState('');
  const [editEventTarget, setEditEventTarget] = useState(0);
  const [editEventStart, setEditEventStart] = useState('');
  const [editEventEnd, setEditEventEnd] = useState('');

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

  const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

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
    const newEvent: Event = {
      id: Date.now().toString(),
      name: newEventName,
      targetCount: newEventTarget,
      currentCount: 0,
      startDate: newEventStart,
      endDate: newEventEnd,
      status: 'ACTIVE'
    };
    onAddEvent(newEvent);
    setShowEventModal(false);
    // Reset form
    setNewEventName('');
    setNewEventTarget(50);
    setNewEventStart('');
    setNewEventEnd('');
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
    setEditEventStart(event.startDate);
    setEditEventEnd(event.endDate);
  };

  const handleUpdateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    const updatedEvent: Event = {
      ...editingEvent,
      name: editEventName,
      targetCount: editEventTarget,
      startDate: editEventStart,
      endDate: editEventEnd,
    };

    onUpdateEvent(updatedEvent);
    setEditingEvent(null);
  };

  const handleDeleteClick = (event: Event) => {
    if (event.currentCount > 0) {
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
    onStartAudit(eventId);
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

  const continuingEvents = events.filter(e => e.status === 'ACTIVE' && e.currentCount > 0);
  const activeEvents = events.filter(e => e.status === 'ACTIVE' && e.currentCount === 0);
  const passiveEvents = events.filter(e => e.status === 'PASSIVE');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Etkinlik Sistemi</h1>
            <span className="bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 text-xs px-2 py-1 rounded-full font-bold uppercase">
              {isAdmin ? 'Yönetici' : 'Kullanıcı'}
            </span>
            <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase border border-green-200 dark:border-green-800 animate-pulse">
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {activeTab === 'EVENTS' ? 'Aktif Denetimler' : 'Sistem Kullanıcıları'}
          </h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('EVENTS')}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border ${activeTab === 'EVENTS' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white' : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Calendar size={16} /> Etkinlik
                </button>
                <button
                  onClick={() => setActiveTab('USERS')}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border ${activeTab === 'USERS' ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm text-gray-900 dark:text-white' : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Users size={16} /> Kullanıcı
                </button>
              </>
            )}

            {isAdmin && activeTab === 'EVENTS' && (
              <button
                onClick={() => setShowEventModal(true)}
                className="flex-1 sm:flex-none px-3 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700 shadow-sm flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Ekle
              </button>
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
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Aktif Etkinlikler ({activeEvents.length})</h3>
              </div>
              {activeEvents.map((event) => {
                const now = new Date();
                let start = new Date();
                try {
                  start = event.startDate ? new Date(event.startDate) : new Date();
                } catch (e) { console.warn('Date parse error', e) }
                const isOverdueAndEmpty = event.startDate && now > start && event.currentCount === 0;

                return (
                  <div key={event.id} className={`rounded-xl border p-4 sm:p-6 shadow-sm hover:shadow-md transition ${isOverdueAndEmpty ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white break-words">{event.name}</h3>
                            {isOverdueAndEmpty && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800 uppercase tracking-wide">
                                Veri Girişi Yok
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${isOverdueAndEmpty ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'}`}>
                              <Clock size={12} />
                              {formatDate(event.startDate)}
                            </div>
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">
                              <Clock size={12} />
                              {formatDate(event.endDate)}
                            </div>
                          </div>
                          {isOverdueAndEmpty && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                              ! Etkinlik süresi başladı ancak henüz okutma yapılmadı.
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                            <span>Hedef: {event.targetCount}</span>
                            <span>•</span>
                            <span className={event.currentCount >= event.targetCount ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                              {event.currentCount} / {event.targetCount}
                            </span>
                          </div>
                          {/* Progress Bar in Card */}
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2 max-w-xs">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (event.currentCount / event.targetCount) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleStartAuditClick(event.id)}
                            className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition"
                            title="Denetimi Başlat"
                          >
                            <Play size={20} className="fill-current" />
                          </button>
                          <button
                            onClick={() => setViewingEvent(event)}
                            className="p-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition"
                            title="Listeyi Gör"
                          >
                            <Eye size={20} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditEventModal(event)}
                                className="p-2.5 text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition"
                                title="Düzenle"
                              >
                                <Edit size={20} />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(event)}
                                className="p-2.5 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition"
                              >
                                <Trash2 size={20} />
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
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-dashed">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aktif Etkinlik Yok</h3>
                  {isAdmin && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Yeni bir etkinlik oluşturarak başlayın.</p>}
                </div>
              )}
            </div>

            {/* Continuing Audits Section */}
            {continuingEvents.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="text-green-600 dark:text-green-400" size={20} />
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Devam Eden ({continuingEvents.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {continuingEvents.map(event => (
                    <div
                      key={event.id}
                      className="relative bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-green-400 dark:hover:border-green-600 transition text-left group w-full"
                    >
                      {/* Delete Button (Absolute top-right) */}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(event);
                          }}
                          className="absolute top-2 right-2 p-2 bg-white/50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded-lg transition z-10"
                          title="Etkinliği Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <div onClick={() => handleStartAuditClick(event.id)} className="cursor-pointer">
                        <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400 truncate pr-8">{event.name}</h4>
                        <div className="mt-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                          <span>Doluluk</span>
                          <span className="font-mono">{event.currentCount} / {event.targetCount}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (event.currentCount / event.targetCount) * 100)}%` }}
                          ></div>
                        </div>

                        {/* User Stats for Continuing Events */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Object.entries(scannedEntries[event.id]?.reduce((acc, entry) => {
                            acc[entry.recordedBy] = (acc[entry.recordedBy] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>) || {}).map(([user, count]) => (
                            <span key={user} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                              <UserIcon size={10} /> {user}: {count}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                          <Play size={12} className="fill-current" />
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
                <div className="space-y-3 opacity-80 hover:opacity-100 transition">
                  {passiveEvents.map(event => (
                    <div key={event.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="w-full sm:w-auto">
                        <h4 className="font-bold text-gray-700 dark:text-gray-300">{event.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tamamlandı • {event.currentCount}/{event.targetCount}</p>
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
                          <Eye size={20} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEditEventModal(event)}
                              className="p-2 text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Etkinliği Düzenle"
                            >
                              <Edit size={20} />
                            </button>
                            <button
                              onClick={() => onReactivateEvent(event.id)}
                              className="p-2 text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Denetimi Tekrar Aktif Et"
                            >
                              <RefreshCw size={20} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(event)}
                              className="p-2 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Etkinliği Sil"
                            >
                              <Trash2 size={20} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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
                    type="number"
                    value={editEventTarget}
                    onChange={(e) => setEditEventTarget(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    min="1"
                    required
                  />
                </div>

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
                    type="number"
                    value={newEventTarget}
                    onChange={(e) => setNewEventTarget(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-secondary-500 outline-none"
                    min="1"
                    required
                  />
                </div>

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



              {/* Registrar Stats */}
              <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Kaydeden İstatistikleri</h3>
                <div className="flex flex-wrap gap-2">
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
    </div >
  );
};

export default AdminDashboard;