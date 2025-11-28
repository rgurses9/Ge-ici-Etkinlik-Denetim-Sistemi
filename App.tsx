import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AuditScreen from './components/AuditScreen';
import { User, Event, ScanEntry, SessionState, Citizen } from './types';
import { INITIAL_USERS, INITIAL_EVENTS } from './constants';

const App: React.FC = () => {
  // --- Global State ---
  const [session, setSession] = useState<SessionState>({
    isAuthenticated: false,
    currentUser: null,
  });

  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage or preference
    if (typeof window !== 'undefined') {
       return localStorage.getItem('geds_theme') === 'dark';
    }
    return false;
  });

  // Apply Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('geds_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('geds_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  
  // Audit State
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [scannedEntries, setScannedEntries] = useState<Record<string, ScanEntry[]>>({});

  // Real-time Sync Channel
  const channelRef = useRef<BroadcastChannel | null>(null);

  // --- Real-time Sync Setup ---
  useEffect(() => {
    // Create a broadcast channel for real-time communication between tabs
    const channel = new BroadcastChannel('geds_live_traffic_channel');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      console.log('Real-time update received:', type);

      if (type === 'NEW_SCAN') {
        const entry = payload as ScanEntry;
        // Update Scanned Entries
        setScannedEntries(prev => {
          const eventEntries = prev[entry.eventId] || [];
          // Avoid duplicates if latency causes double send
          if (eventEntries.find(e => e.id === entry.id)) return prev;
          return {
            ...prev,
            [entry.eventId]: [...eventEntries, entry]
          };
        });
        // Update Event Count
        setEvents(prevEvents => prevEvents.map(e => 
          e.id === entry.eventId 
            ? { ...e, currentCount: e.currentCount + 1 }
            : e
        ));
      }

      if (type === 'BULK_SCAN') {
        const entries = payload as ScanEntry[];
        if (entries.length === 0) return;
        const eventId = entries[0].eventId;

        setScannedEntries(prev => {
          const eventEntries = prev[eventId] || [];
          // Filter duplicates
          const newUnique = entries.filter(n => !eventEntries.find(e => e.id === n.id));
          return {
            ...prev,
            [eventId]: [...eventEntries, ...newUnique]
          };
        });

        setEvents(prevEvents => prevEvents.map(e => 
          e.id === eventId 
            ? { ...e, currentCount: e.currentCount + entries.length }
            : e
        ));
      }

      if (type === 'DELETE_SCAN') {
        const { entryId, eventId } = payload;
        setScannedEntries(prev => {
          const eventEntries = prev[eventId] || [];
          return {
            ...prev,
            [eventId]: eventEntries.filter(e => e.id !== entryId)
          };
        });
        setEvents(prevEvents => prevEvents.map(e => 
          e.id === eventId 
            ? { ...e, currentCount: Math.max(0, e.currentCount - 1) }
            : e
        ));
      }

      if (type === 'UPDATE_EVENTS') {
        // Full event list sync for status changes
        setEvents(payload);
      }

      if (type === 'UPDATE_USERS') {
        setUsers(payload);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // --- Helper to Broadcast ---
  const broadcast = (type: string, payload: any) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type, payload });
    }
  };

  // --- Handlers ---

  const handleLogin = (user: User) => {
    setSession({
      isAuthenticated: true,
      currentUser: user,
    });
  };

  const handleLogout = () => {
    setSession({
      isAuthenticated: false,
      currentUser: null,
    });
    setActiveEventId(null);
  };

  const handleAddEvent = (event: Event) => {
    const newEvents = [...events, event];
    setEvents(newEvents);
    broadcast('UPDATE_EVENTS', newEvents);
  };

  const handleDeleteEvent = (id: string) => {
    const newEvents = events.filter(e => e.id !== id);
    setEvents(newEvents);
    broadcast('UPDATE_EVENTS', newEvents);
  };

  const handleReactivateEvent = (id: string) => {
    const newEvents = events.map(e => 
      e.id === id 
        ? { ...e, status: 'ACTIVE' as const, completionDuration: undefined }
        : e
    );
    setEvents(newEvents);
    broadcast('UPDATE_EVENTS', newEvents);
  };

  const handleStartAudit = (eventId: string) => {
    setActiveEventId(eventId);
  };

  const handleEndAudit = () => {
    // Just close the screen, don't change status (e.g. clicking X)
    setActiveEventId(null);
  };

  const handleFinishAndCloseAudit = (duration: string) => {
    if (activeEventId) {
      const newEvents = events.map(e => 
        e.id === activeEventId 
          ? { ...e, status: 'PASSIVE' as const, completionDuration: duration }
          : e
      );
      setEvents(newEvents);
      setActiveEventId(null);
      broadcast('UPDATE_EVENTS', newEvents);
    }
  };

  const handleScan = (entry: ScanEntry) => {
    // Local Update
    setScannedEntries(prev => {
      const eventEntries = prev[entry.eventId] || [];
      return {
        ...prev,
        [entry.eventId]: [...eventEntries, entry]
      };
    });

    setEvents(prevEvents => prevEvents.map(e => 
      e.id === entry.eventId 
        ? { ...e, currentCount: e.currentCount + 1 }
        : e
    ));

    // Broadcast Real-time
    broadcast('NEW_SCAN', entry);
  };

  const handleBulkScan = (newEntries: ScanEntry[]) => {
    if (newEntries.length === 0) return;
    const eventId = newEntries[0].eventId;

    // Local Update
    setScannedEntries(prev => {
      const eventEntries = prev[eventId] || [];
      return {
        ...prev,
        [eventId]: [...eventEntries, ...newEntries]
      };
    });

    setEvents(prevEvents => prevEvents.map(e => 
      e.id === eventId 
        ? { ...e, currentCount: e.currentCount + newEntries.length }
        : e
    ));

    // Broadcast Real-time
    broadcast('BULK_SCAN', newEntries);
  };

  const handleDeleteScan = (entryId: string) => {
    if (!activeEventId) return;

    // Local Update
    setScannedEntries(prev => {
      const eventEntries = prev[activeEventId] || [];
      return {
        ...prev,
        [activeEventId]: eventEntries.filter(e => e.id !== entryId)
      };
    });

    setEvents(prevEvents => prevEvents.map(e => 
      e.id === activeEventId 
        ? { ...e, currentCount: Math.max(0, e.currentCount - 1) }
        : e
    ));

    // Broadcast Real-time
    broadcast('DELETE_SCAN', { entryId, eventId: activeEventId });
  };

  const handleDatabaseUpdate = (freshDatabase: Citizen[]) => {
    // This logic runs locally on each client when they connect to DB.
    // If we wanted to sync this, we would broadcast UPDATE_SCAN_ENTRIES, 
    // but typically each client validates against the fresh DB independently.
    setScannedEntries(prev => {
      const newEntries = { ...prev };
      let hasChanges = false;

      Object.keys(newEntries).forEach(eventId => {
        newEntries[eventId] = newEntries[eventId].map(entry => {
          if (entry.citizen.name === 'Veri Tabanında' && entry.citizen.surname === 'Bulunamadı') {
            const foundInDb = freshDatabase.find(c => c.tc === entry.citizen.tc);
            if (foundInDb) {
              hasChanges = true;
              return {
                ...entry,
                citizen: { ...foundInDb }
              };
            }
          }
          return entry;
        });
      });

      return hasChanges ? newEntries : prev;
    });
  };

  const handleAddUser = (user: User) => {
    const newUsers = [...users, user];
    setUsers(newUsers);
    broadcast('UPDATE_USERS', newUsers);
  }

  const handleUpdateUser = (updatedUser: User) => {
    const newUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(newUsers);
    broadcast('UPDATE_USERS', newUsers);
  };

  // --- Render Logic ---

  if (!session.isAuthenticated || !session.currentUser) {
    return (
      <Login 
        users={users} 
        onLogin={handleLogin} 
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (activeEventId) {
    const activeEvent = events.find(e => e.id === activeEventId);
    if (!activeEvent) return <div>Hata: Etkinlik bulunamadı.</div>;

    const currentList = scannedEntries[activeEventId] || [];

    return (
      <AuditScreen 
        event={activeEvent} 
        allEvents={events}
        currentUser={session.currentUser}
        onExit={handleEndAudit} 
        onFinish={handleFinishAndCloseAudit}
        onScan={handleScan}
        onBulkScan={handleBulkScan}
        onDelete={handleDeleteScan}
        scannedList={currentList}
        allScannedEntries={scannedEntries}
        onDatabaseUpdate={handleDatabaseUpdate}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <AdminDashboard 
      currentUser={session.currentUser}
      events={events}
      users={users}
      scannedEntries={scannedEntries}
      onLogout={handleLogout}
      onStartAudit={handleStartAudit}
      onAddEvent={handleAddEvent}
      onDeleteEvent={handleDeleteEvent}
      onReactivateEvent={handleReactivateEvent}
      onAddUser={handleAddUser}
      onUpdateUser={handleUpdateUser}
      isDarkMode={isDarkMode}
      onToggleTheme={toggleTheme}
    />
  );
};

export default App;