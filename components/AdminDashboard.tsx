
import React, { useState } from 'react';
import { Event, User, UserRole, ScanEntry } from '../types';
import { Plus, Users, Calendar, Play, Settings, LogOut, Eye, Trash2, Edit, UserCog, Key, Shield, Check, X, ShieldCheck, User as UserIcon, Activity, Archive, Download, RefreshCw, Clock, Wifi } from 'lucide-react';

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
}) => {
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'USERS'>('EVENTS');
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);

  // New Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [newEventTarget, setNewEventTarget] = useState(50);
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');

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
  // newUserFullName removed as per request
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<UserRole[]>([UserRole.PERSONNEL]);

  const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

  // --- Handlers ---

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
      fullName: newUserUsername, // Use username as fullname since field is removed
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

  const handleStartAuditClick = (eventId?: string) => {
    const idToStart = eventId || selectedEventId;
    if (idToStart) {
      onStartAudit(idToStart);
    }
  };

  const checkWorkStatus = (dateStr: string) => {
    // If no date or explicit hyphen
    if (!dateStr || dateStr === '-' || dateStr.trim() === '') {
      return { text: 'BELİRSİZ', color: 'text-gray-500', bg: 'bg-gray-100' };
    }

    let targetDate: Date | null = null;

    // Handle YYYY-MM-DD
    if (dateStr.includes('-') && dateStr.length === 10) {
       targetDate = new Date(dateStr);
    } 
    // Handle DD.MM.YYYY
    else if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        // new Date(year, monthIndex, day)
        targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
       // Could not parse
       return { text: 'TARİH HATALI', color: 'text-gray-500', bg: 'bg-gray-100' };
    }

    // Compare with today (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate >= today) {
      return { text: 'ÇALIŞIR', color: 'text-green-700', bg: 'bg-green-100' };
    } else {
      return { text: 'ÇALIŞAMAZ', color: 'text-red-700', bg: 'bg-red-100' };
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

  // Helper for checkbox handling
  const toggleEditUserRole = (role: UserRole) => {
    if (!editingUser) return;
    const currentRoles = editingUser.roles;
    if (currentRoles.includes(role)) {
      setEditingUser({ ...editingUser, roles: currentRoles.filter(r => r !== role) });
    } else {
      setEditingUser({ ...editingUser, roles: [...currentRoles, role] });
    }
  };

  const toggleNewUserRole = (role: UserRole) => {
    if (newUserRoles.includes(role)) {
      setNewUserRoles(newUserRoles.filter(r => r !== role));
    } else {
      setNewUserRoles([...newUserRoles, role]);
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

  const continuingEvents = events.filter(e => e.status === 'ACTIVE' && e.currentCount > 0 && e.currentCount < e.targetCount);
  const activeEvents = events.filter(e => e.status === 'ACTIVE');
  const passiveEvents = events.filter(e => e.status === 'PASSIVE');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Geçici Etkinlik Denetim Sistemi</h1>
            <span className="bg-secondary-100 text-secondary-600 text-xs px-2 py-1 rounded-full font-bold uppercase">
              {isAdmin ? 'Yönetici' : 'Kullanıcı'}
            </span>
            <span className="flex items-center gap-1 bg-green-50 text-green-600 text-[10px] px-2 py-1 rounded-full font-bold uppercase border border-green-200 animate-pulse">
              <Wifi size={10} />
              Canlı Trafik
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <UserIcon size={16} />
              {currentUser.fullName}
            </div>
            <button 
              onClick={() => setShowSelfPasswordChange(true)}
              className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition flex items-center gap-2"
            >
              <Key size={16} /> Şifre Değiştir
            </button>
            <button 
              onClick={onLogout}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center gap-2"
            >
              <LogOut size={16} /> Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'EVENTS' ? 'Aktif Denetimler' : 'Sistem Kullanıcıları'}
          </h2>
          <div className="flex gap-3">
             {isAdmin && (
               <>
                 <button 
                  onClick={() => setActiveTab('EVENTS')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border ${activeTab === 'EVENTS' ? 'bg-white border-gray-300 shadow-sm text-gray-900' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100'}`}
                >
                  <Calendar size={16} /> Etkinlikler
                </button>
                <button 
                  onClick={() => setActiveTab('USERS')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border ${activeTab === 'USERS' ? 'bg-white border-gray-300 shadow-sm text-gray-900' : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100'}`}
                >
                  <Users size={16} /> Kullanıcılar
                </button>
               </>
             )}
            
            {isAdmin && activeTab === 'EVENTS' && (
              <button 
                onClick={() => setShowEventModal(true)}
                className="ml-2 px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700 shadow-sm flex items-center gap-2"
              >
                <Plus size={16} /> Etkinlik Ekle
              </button>
            )}
            
            {isAdmin && activeTab === 'USERS' && (
              <button 
                onClick={() => setShowAddUserModal(true)}
                className="ml-2 px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700 shadow-sm flex items-center gap-2"
              >
                <Plus size={16} /> Kullanıcı Ekle
              </button>
            )}
          </div>
        </div>

        {activeTab === 'EVENTS' ? (
          <>
            {/* Active Event List */}
            <div className="space-y-4">
              {activeEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 font-medium bg-gray-50 w-fit px-2 py-1 rounded">
                        <Clock size={12} />
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span>Hedef: {event.targetCount} kişi</span>
                        <span>•</span>
                        <span className={event.currentCount >= event.targetCount ? "text-green-600 font-medium" : ""}>
                          {event.currentCount} / {event.targetCount} (%{Math.round((event.currentCount/event.targetCount)*100) || 0})
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setViewingEvent(event)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                        title="Okutulan Listeyi Gör"
                      >
                        <Eye size={20} />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => onDeleteEvent(event.id)}
                          className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {activeEvents.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Aktif Etkinlik Yok</h3>
                    {isAdmin && <p className="mt-1 text-sm text-gray-500">Yeni bir etkinlik oluşturarak başlayın.</p>}
                </div>
              )}
            </div>

            {/* Continuing Audits Section */}
            {continuingEvents.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                   <Activity className="text-green-600" size={20} />
                   <h3 className="text-xl font-bold text-gray-800">Devam Eden Denetimler</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {continuingEvents.map(event => (
                    <button 
                      key={event.id}
                      onClick={() => handleStartAuditClick(event.id)}
                      className="bg-white border border-green-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-green-400 transition text-left group"
                    >
                      <h4 className="font-bold text-gray-900 group-hover:text-green-700">{event.name}</h4>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(event.startDate)}
                      </div>
                      <div className="mt-2 flex justify-between text-sm text-gray-500">
                         <span>Doluluk</span>
                         <span className="font-mono">{event.currentCount} / {event.targetCount}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-green-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, (event.currentCount / event.targetCount) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="mt-3 text-xs text-green-600 font-medium flex items-center gap-1">
                        <Play size={12} className="fill-current" />
                        Denetime Devam Et
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

             {/* Passive Events Section */}
            {passiveEvents.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                   <Archive className="text-gray-500" size={20} />
                   <h3 className="text-xl font-bold text-gray-800">Pasif Etkinlikler</h3>
                </div>
                <div className="space-y-3 opacity-80 hover:opacity-100 transition">
                  {passiveEvents.map(event => (
                    <div key={event.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 shadow-sm flex justify-between items-center">
                       <div>
                         <h4 className="font-bold text-gray-700">{event.name}</h4>
                         <div className="flex items-center gap-2">
                           <p className="text-xs text-gray-500 mt-1">Tamamlandı • {event.currentCount}/{event.targetCount}</p>
                           <span className="text-xs text-gray-400">•</span>
                           <p className="text-xs text-gray-400 mt-1">{formatDate(event.startDate)}</p>
                           {event.completionDuration && (
                             <>
                               <span className="text-xs text-gray-400">•</span>
                               <p className="text-xs text-gray-600 mt-1 font-mono flex items-center gap-1">
                                 <Clock size={10} /> {event.completionDuration}
                               </p>
                             </>
                           )}
                         </div>
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                           TAMAMLANDI
                         </div>
                         <button 
                            onClick={() => setViewingEvent(event)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            title="Listeyi Gör"
                          >
                            <Eye size={20} />
                          </button>
                          {isAdmin && (
                            <>
                              <button 
                                onClick={() => onReactivateEvent(event.id)}
                                className="p-2 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                title="Denetimi Tekrar Aktif Et"
                              >
                                <RefreshCw size={20} />
                              </button>
                              <button 
                                onClick={() => onDeleteEvent(event.id)}
                                className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
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

            {/* Start Audit Section */}
            <div className="mt-8 bg-primary-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Play className="fill-current" />
                <h3 className="text-xl font-bold">Denetim Başlat</h3>
              </div>
              <div className="bg-primary-700/50 p-6 rounded-xl border border-primary-500/30">
                <label className="block text-sm font-medium text-primary-100 mb-2">Etkinlik Seç</label>
                <select 
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-primary-800 border border-primary-500 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-white focus:outline-none"
                >
                  <option value="">-- Etkinlik Seçin --</option>
                  {activeEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button 
                  disabled={!selectedEventId}
                  onClick={() => handleStartAuditClick()}
                  className="mt-4 w-full bg-white text-primary-600 font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  <Play size={18} className="fill-current" />
                  Denetimi Başlat
                </button>
              </div>
            </div>
          </>
        ) : (
          /* User List - Only visible if isAdmin check passes in render (double check) */
          isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2 px-1">
                <span>Toplam {users.length} kullanıcı listeleniyor</span>
              </div>
              {users.map((user) => (
                <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <UserIcon size={24} />
                     </div>
                     <div>
                        <h3 className="font-bold text-gray-900">{user.username}</h3>
                        {/* fullName is now same as username usually, or empty if we removed logic, but keeping display generic */}
                        {user.fullName !== user.username && <p className="text-sm text-gray-500">{user.fullName}</p>}
                     </div>
                     <div className="ml-2 flex flex-wrap gap-1">
                       {user.roles.includes(UserRole.ADMIN) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            YÖNETİCİ
                          </span>
                       )}
                       {user.roles.includes(UserRole.PERSONNEL) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            KULLANICI
                          </span>
                       )}
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                     <button 
                      onClick={() => setEditingUser({ ...user })}
                      className="flex-1 sm:flex-none px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium flex items-center justify-center gap-2 transition"
                     >
                       <UserCog size={16} /> Düzenle
                     </button>
                     <button 
                      onClick={() => setShowPasswordReset(user)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-sm font-medium flex items-center justify-center gap-2 transition"
                     >
                       <Key size={16} /> Şifre Sıfırla
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

      </main>

      {/* Modal: Add Event */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-primary-600">
                <Edit size={24} />
                <h3 className="text-xl font-bold text-gray-900">Etkinlik Ekle</h3>
              </div>
              <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etkinlik İsmi</label>
                <input 
                  type="text" 
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none"
                  style={{ backgroundColor: '#374151' }}
                  placeholder="Galatasaray - Fenerbahçe"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Kişi Sayısı</label>
                <input 
                  type="number" 
                  value={newEventTarget}
                  onChange={(e) => setNewEventTarget(parseInt(e.target.value))}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 outline-none"
                  style={{ backgroundColor: '#374151' }}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                   <input 
                      type="datetime-local"
                      value={newEventStart}
                      onChange={(e) => setNewEventStart(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded-lg px-2 py-2 text-sm border border-gray-600"
                      style={{ backgroundColor: '#374151' }}
                      required
                   />
                </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                   <input 
                      type="datetime-local"
                      value={newEventEnd}
                      onChange={(e) => setNewEventEnd(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded-lg px-2 py-2 text-sm border border-gray-600"
                      style={{ backgroundColor: '#374151' }}
                      required
                   />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary-600 text-white font-medium py-2 rounded-lg hover:bg-primary-700"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Scanned Entries */}
      {viewingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
               <div>
                 <h3 className="text-xl font-bold text-gray-900">{viewingEvent.name}</h3>
                 <p className="text-sm text-gray-500">Okutulan Kimlik Listesi</p>
               </div>
               <div className="flex items-center gap-3">
                 <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                 >
                    <Download size={16} /> Excel'e Aktar
                 </button>
                 <button onClick={() => setViewingEvent(null)} className="text-gray-400 hover:text-gray-600">
                   <X size={24} />
                 </button>
               </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
               {(scannedEntries[viewingEvent.id] && scannedEntries[viewingEvent.id].length > 0) ? (
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                     <tr>
                       <th className="px-4 py-3 font-medium text-gray-500 w-12">NO</th>
                       <th className="px-4 py-3 font-medium text-gray-500">TC No</th>
                       <th className="px-4 py-3 font-medium text-gray-500">Ad Soyad</th>
                       <th className="px-4 py-3 font-medium text-gray-500">Geçerlilik Tarihi</th>
                       <th className="px-4 py-3 font-medium text-gray-500">Durum</th>
                       <th className="px-4 py-3 font-medium text-gray-500 text-right">Saat</th>
                       <th className="px-4 py-3 font-medium text-gray-500 text-right">Kaydeden</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {scannedEntries[viewingEvent.id].map((entry, index) => {
                       const status = checkWorkStatus(entry.citizen.validityDate);
                       return (
                         <tr key={entry.id} className="hover:bg-gray-50">
                           <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                           <td className="px-4 py-3 text-gray-900 font-mono">{entry.citizen.tc}</td>
                           <td className="px-4 py-3 text-gray-900 font-medium">
                             {entry.citizen.name} {entry.citizen.surname}
                           </td>
                           <td className="px-4 py-3 text-gray-500 font-mono">
                             {entry.citizen.validityDate}
                           </td>
                           <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${status.bg} ${status.color}`}>
                                {status.text}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-gray-500 text-right">{entry.timestamp}</td>
                           <td className="px-4 py-3 text-gray-500 text-right">
                             <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                               {entry.recordedBy}
                             </span>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                       <Users size={32} />
                    </div>
                    <p>Henüz kayıt bulunmamaktadır.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit User (Role) */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <UserCog size={24} />
                  <h3 className="text-lg font-bold text-gray-900">Kullanıcı Yetkilerini Düzenle</h3>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
             </div>

             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-500 mb-1">Kullanıcı Adı</label>
                 <div className="bg-gray-100 px-4 py-3 rounded-lg text-gray-700 font-mono">
                   {editingUser.username}
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Yetki Seviyesi</label>
                 <div className="grid grid-cols-2 gap-3">
                    <label 
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition cursor-pointer select-none ${editingUser.roles.includes(UserRole.PERSONNEL) ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={editingUser.roles.includes(UserRole.PERSONNEL)}
                        onChange={() => toggleEditUserRole(UserRole.PERSONNEL)}
                        className="hidden"
                      />
                      {editingUser.roles.includes(UserRole.PERSONNEL) && <Check size={16} />}
                      Kullanıcı
                    </label>

                    <label 
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition cursor-pointer select-none ${editingUser.roles.includes(UserRole.ADMIN) ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={editingUser.roles.includes(UserRole.ADMIN)}
                        onChange={() => toggleEditUserRole(UserRole.ADMIN)}
                        className="hidden"
                      />
                      {editingUser.roles.includes(UserRole.ADMIN) && <Check size={16} />}
                      Yönetici
                    </label>
                 </div>
               </div>

               <button 
                onClick={handleSaveUserRole}
                className="w-full mt-2 bg-primary-600 text-white font-bold py-3 rounded-lg hover:bg-primary-700"
               >
                 Değişiklikleri Kaydet
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Modal: Admin Password Reset for other users */}
      {showPasswordReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Key size={24} />
                    <h3 className="text-lg font-bold text-gray-900">Şifre Sıfırla</h3>
                  </div>
                  <button onClick={() => setShowPasswordReset(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  <span className="font-bold">{showPasswordReset.username}</span> kullanıcısı için yeni şifre belirleyin.
                </p>
                
                <input 
                  type="text" 
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 rounded-lg px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Yeni şifreyi girin"
                />

                <button 
                  onClick={handleSavePassword}
                  disabled={!tempPassword}
                  className="w-full bg-primary-600 text-white font-bold py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Şifreyi Güncelle
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal: Self Password Change */}
      {showSelfPasswordChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Key size={24} />
                    <h3 className="text-lg font-bold text-gray-900">Şifre Değiştir</h3>
                  </div>
                  <button onClick={() => setShowSelfPasswordChange(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
              </div>

              <form onSubmit={handleSaveSelfPassword} className="space-y-4">
                <p className="text-sm text-gray-600">
                  Kendi hesabınız için yeni şifre belirleyin.
                </p>
                
                <input 
                  type="password" 
                  value={selfNewPassword}
                  onChange={(e) => setSelfNewPassword(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 rounded-lg px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Yeni şifreniz"
                  required
                />

                <button 
                  type="submit"
                  disabled={!selfNewPassword}
                  className="w-full bg-primary-600 text-white font-bold py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Değişiklikleri Kaydet
                </button>
              </form>
           </div>
        </div>
      )}

      {/* Modal: Add User */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2 text-secondary-600">
                    <Plus size={24} />
                    <h3 className="text-lg font-bold text-gray-900">Kullanıcı Ekle</h3>
                  </div>
                  <button onClick={() => setShowAddUserModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
                    <input 
                      type="text"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-secondary-500 outline-none text-gray-900"
                      required
                    />
                 </div>
                 {/* Ad Soyad removed as requested */}
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                    <input 
                      type="text"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-secondary-500 outline-none text-gray-900"
                      required
                    />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Roller</label>
                   <div className="flex gap-4">
                     <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={newUserRoles.includes(UserRole.PERSONNEL)}
                         onChange={() => toggleNewUserRole(UserRole.PERSONNEL)}
                         className="text-secondary-600 focus:ring-secondary-500"
                       />
                       <span className="text-gray-900">Kullanıcı</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={newUserRoles.includes(UserRole.ADMIN)} 
                         onChange={() => toggleNewUserRole(UserRole.ADMIN)}
                         className="text-secondary-600 focus:ring-secondary-500"
                       />
                       <span className="text-gray-900">Yönetici</span>
                     </label>
                   </div>
                 </div>

                 <button 
                  type="submit"
                  className="w-full mt-4 bg-secondary-600 text-white font-bold py-3 rounded-lg hover:bg-secondary-700"
                 >
                   Kaydet
                 </button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
