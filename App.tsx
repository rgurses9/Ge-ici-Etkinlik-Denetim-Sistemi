import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AuditScreen from './components/AuditScreen';
import { User, Event, ScanEntry, SessionState, Citizen } from './types';
import { INITIAL_USERS, INITIAL_EVENTS } from './constants';
import { db } from './firebase';
import {
  collection,
  // onSnapshot removed — no more real-time listeners to save reads
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  writeBatch,
  getDocs,
  where,
  increment
} from 'firebase/firestore';

const App: React.FC = () => {
  // --- Global State ---
  const [session, setSession] = useState<SessionState>(() => {
    // Check localStorage for existing session
    const savedSession = localStorage.getItem('geds_session');
    if (savedSession) {
      try {
        return JSON.parse(savedSession);
      } catch (e) {
        console.error('Failed to parse session from localStorage', e);
      }
    }
    return {
      isAuthenticated: false,
      currentUser: null,
    };
  });

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [scannedEntries, setScannedEntries] = useState<Record<string, ScanEntry[]>>({});

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
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
  const [activeEventId, setActiveEventId] = useState<string | null>(() => {
    return localStorage.getItem('geds_active_event_id');
  });

  // Persist activeEventId changes
  useEffect(() => {
    if (activeEventId) {
      localStorage.setItem('geds_active_event_id', activeEventId);
    } else {
      localStorage.removeItem('geds_active_event_id');
    }
  }, [activeEventId]);

  // --- Firestore Subscriptions ---

  // Refresh users function (for login troubleshooting)
  const loadUsersFromFirebase = async (forceRefresh = false) => {
    console.log('🔄 Refreshing users from Firebase...');
    setIsUsersLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('username', 'asc'));
      const snapshot = await getDocs(q);
      const fetchedUsers: User[] = snapshot.docs.map(doc => doc.data() as User);

      if (fetchedUsers.length === 0) {
        console.log("🌱 Seeding initial users...");
        for (const user of INITIAL_USERS) {
          await setDoc(doc(db, 'users', user.id), user);
        }
        setUsers(INITIAL_USERS);
      } else {
        setUsers(fetchedUsers);
        console.log(`✅ Users refreshed: ${fetchedUsers.length}`);
      }
    } catch (error: any) {
      console.error("❌ Error refreshing users:", error);
      throw error;
    } finally {
      setIsUsersLoading(false);
    }
  };

  // 1. Users Subscription & Initial Seeding
  // 1. Users Loading (Max Optimization: Cache-First)
  useEffect(() => {
    const loadUsers = async () => {
      const cachedUsers = localStorage.getItem('geds_users_cache');
      if (cachedUsers) {
        setUsers(JSON.parse(cachedUsers));
        setIsUsersLoading(false);
      }

      try {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        const fetchedUsers: User[] = snapshot.docs.map(doc => doc.data() as User);

        if (fetchedUsers.length > 0) {
          setUsers(fetchedUsers);
          localStorage.setItem('geds_users_cache', JSON.stringify(fetchedUsers));
        }
      } catch (e) {
        console.warn("Users fetch from server failed, relying on cache.", e);
      } finally {
        setIsUsersLoading(false);
      }
    };
    loadUsers();
  }, []);

  // 2. Events Loading (MAX Optimization: Initial Load Once)
  useEffect(() => {
    if (!session.isAuthenticated) return;

    const loadEventsOnce = async () => {
      try {
        // Load from cache first for instant UI
        const cachedEvents = localStorage.getItem('geds_events_cache');
        if (cachedEvents) {
          setEvents(JSON.parse(cachedEvents));
        }

        console.log('📡 Fetching events ONCE from server for cost saving...');
        const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
        const snapshot = await getDocs(q);
        const fetchedEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

        setEvents(fetchedEvents);
        localStorage.setItem('geds_events_cache', JSON.stringify(fetchedEvents));
        console.log(`✅ Events loaded once: ${fetchedEvents.length}`);
      } catch (error) {
        console.error("Events fetch error", error);
      }
    };

    loadEventsOnce();
  }, [session.isAuthenticated]);

  // Auto-sync events to cache (ensures optimistic updates persist across page refreshes)
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('geds_events_cache', JSON.stringify(events));
    }
  }, [events]);

  // Conflict Check (PURE LOCAL - Zero Firestore Reads)
  const checkCitizenshipConflict = async (tc: string, ignoreEventId: string): Promise<string | null> => {
    try {
      let otherScans: ScanEntry[] = [];

      // ONLY check local state — no Firestore query at all
      Object.keys(scannedEntries).forEach(eid => {
        if (eid === ignoreEventId) return;
        const entry = scannedEntries[eid]?.find(s => s.citizen.tc === tc);
        if (entry) otherScans.push(entry);
      });

      if (otherScans.length === 0) return null;

      const currentEvent = events.find(e => e.id === ignoreEventId);
      if (!currentEvent) return null;

      const currentStart = new Date(currentEvent.startDate).getTime();
      const currentEnd = new Date(currentEvent.endDate).getTime();

      for (const scan of otherScans) {
        const otherEvent = events.find(e => e.id === scan.eventId);
        if (!otherEvent) continue;

        const otherStart = new Date(otherEvent.startDate).getTime();
        const otherEnd = new Date(otherEvent.endDate).getTime();

        if (currentStart < otherEnd && currentEnd > otherStart) {
          return `⚠️ ÇAKIŞMA!\n${tc} TC kimlik numaralı şahıs "${otherEvent.name}" etkinliğinde zaten kayıtlıdır.\nKaydeden: ${scan.recordedBy || 'Bilinmiyor'}\nBu kişiyi tekrar kayıt edemezsiniz. Lütfen oradaki denetlemeci ile iletişime geçiniz.`;
        }
      }

      return null;
    } catch (e) {
      console.error("Conflict check error:", e);
      return null;
    }
  };

  // 3. Optimized Scanned Entries Subscription with Caching
  // A. Load Cache (Run once on auth)
  useEffect(() => {
    if (!session.isAuthenticated) return;

    const cachedEntriesStr = localStorage.getItem('geds_scanned_entries_cache');
    if (cachedEntriesStr) {
      try {
        const cachedEntries = JSON.parse(cachedEntriesStr) as Record<string, ScanEntry[]>;
        if (Object.keys(cachedEntries).length > 0) {
          setScannedEntries(prev => ({ ...prev, ...cachedEntries }));
          console.log(`✅ Loaded cached entries for ${Object.keys(cachedEntries).length} events(Active & Passive)`);
        }
      } catch (e) {
        console.warn('Failed to parse scanned entries cache', e);
      }
    }
  }, [session.isAuthenticated]);

  // B. Scanned Entries (Load current event + overlapping events for conflict detection)
  useEffect(() => {
    if (!session.isAuthenticated || !activeEventId) {
      if (!activeEventId) setScannedEntries({});
      return;
    }

    const loadScannedEntries = async () => {
      try {
        // 1. Try Cache First for instant UI
        const cachedEntriesStr = localStorage.getItem('geds_scanned_entries_cache');
        if (cachedEntriesStr) {
          const cached = JSON.parse(cachedEntriesStr);
          if (cached[activeEventId]) {
            setScannedEntries(prev => ({ ...prev, [activeEventId]: cached[activeEventId] }));
          }
        }

        // 2. Find which events overlap with the current event (for conflict detection)
        const currentEvent = events.find(e => e.id === activeEventId);
        if (!currentEvent) return;

        const currentStart = new Date(currentEvent.startDate).getTime();
        const currentEnd = new Date(currentEvent.endDate).getTime();

        const overlappingEventIds = events
          .filter(e => {
            if (e.id === activeEventId) return true; // Always load current event
            const eStart = new Date(e.startDate).getTime();
            const eEnd = new Date(e.endDate).getTime();
            return currentStart < eEnd && currentEnd > eStart; // Time overlap check
          })
          .map(e => e.id);

        console.log(`📡 Loading scans for ${overlappingEventIds.length} overlapping events (ONE TIME READ)`);

        // 3. Fetch scanned entries for all overlapping events
        const allEntries: Record<string, ScanEntry[]> = {};

        // Firestore 'in' query supports max 30 values, chunk if needed
        for (let i = 0; i < overlappingEventIds.length; i += 10) {
          const chunk = overlappingEventIds.slice(i, i + 10);
          const q = query(
            collection(db, 'scanned_entries'),
            where('eventId', 'in', chunk)
          );
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(d => {
            const entry = d.data() as ScanEntry;
            if (!allEntries[entry.eventId]) allEntries[entry.eventId] = [];
            allEntries[entry.eventId].push(entry);
          });
        }

        // Sort the current event's entries
        if (allEntries[activeEventId]) {
          allEntries[activeEventId].sort((a, b) =>
            (Number(b.serverTimestamp) || 0) - (Number(a.serverTimestamp) || 0)
          );
        }

        setScannedEntries(allEntries);

        // Update Cache
        try {
          const currentCacheStr = localStorage.getItem('geds_scanned_entries_cache');
          let newCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
          Object.assign(newCache, allEntries);
          localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(newCache));
        } catch (e) {
          console.warn("Cache update error", e);
        }

      } catch (e) {
        console.error("Error loading scan entries", e);
      }
    };

    loadScannedEntries();
  }, [session.isAuthenticated, activeEventId, events]);

  // Auto-sync scanned entries to cache
  useEffect(() => {
    if (Object.keys(scannedEntries).length > 0) {
      try {
        const currentCacheStr = localStorage.getItem('geds_scanned_entries_cache');
        let cache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
        Object.assign(cache, scannedEntries);
        localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(cache));
      } catch (e) { /* silent */ }
    }
  }, [scannedEntries]);

  // --- Handlers ---

  const handleLogin = (user: User) => {
    const newSession = {
      isAuthenticated: true,
      currentUser: user,
    };
    setSession(newSession);
    localStorage.setItem('geds_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession({
      isAuthenticated: false,
      currentUser: null,
    });
    setActiveEventId(null);
    localStorage.removeItem('geds_session');
    localStorage.removeItem('geds_active_event_id');
  };

  const handleAddEvent = async (event: Event) => {
    // 1. Prepare clean payload (Firestore doesn't like 'undefined')
    const cleanEvent = JSON.parse(JSON.stringify(event));
    if (!cleanEvent.companies) delete cleanEvent.companies;

    // 2. Optimistic Update
    setEvents(prev => [event, ...prev]);

    try {
      console.log("💾 Saving new event to Firestore...", cleanEvent.id);
      await setDoc(doc(db, 'events', cleanEvent.id), cleanEvent);
      console.log("✅ Event saved successfully");
    } catch (e) {
      console.error("❌ Error adding event: ", e);
      // Rollback optimistic update on error
      const cached = localStorage.getItem('geds_events_cache');
      if (cached) setEvents(JSON.parse(cached));
    }
  };

  const handleUpdateEvent = async (updatedEvent: Event) => {
    // 1. Optimistic Update (Immediate UI Refresh)
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent, currentCount: e.currentCount } : e));

    try {
      const eventRef = doc(db, 'events', updatedEvent.id);

      // 2. Prepare Payload (Exclude currentCount to avoid overwriting real-time data)
      const { currentCount, companies, ...otherFields } = updatedEvent;

      // Remove undefineds from standard fields
      const cleanPayload = JSON.parse(JSON.stringify(otherFields));

      // 3. Handle 'companies': save if present, delete if empty/undefined
      if (companies && companies.length > 0) {
        cleanPayload.companies = companies;
      } else {
        cleanPayload.companies = deleteField();
      }

      await updateDoc(eventRef, cleanPayload);

      // Update Cache (Success)
      const cachedEvents = events.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent, currentCount: e.currentCount } : e);
      localStorage.setItem('geds_events_cache', JSON.stringify(cachedEvents));

    } catch (e) {
      console.error("Error updating event: ", e);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    // Optimistic Update
    const remainingEvents = events.filter(e => e.id !== id);
    setEvents(remainingEvents);
    localStorage.setItem('geds_events_cache', JSON.stringify(remainingEvents));

    try {
      await deleteDoc(doc(db, 'events', id));
    } catch (e) {
      console.error("Error deleting event: ", e);
      // Rollback
      setEvents(events);
      localStorage.setItem('geds_events_cache', JSON.stringify(events));
    }
  };

  const handleReactivateEvent = async (id: string) => {
    // Optimistic Update
    const updatedEvents = events.map(e => e.id === id ? { ...e, status: 'ACTIVE' as const, completionDuration: undefined } : e);
    setEvents(updatedEvents);
    localStorage.setItem('geds_events_cache', JSON.stringify(updatedEvents));

    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, {
        status: 'ACTIVE',
        completionDuration: deleteField() // Correctly delete field
      });
    } catch (e) {
      console.error("Error reactivating event: ", e);
      // Rollback
      setEvents(events);
      localStorage.setItem('geds_events_cache', JSON.stringify(events));
    }
  };

  const handleStartAudit = (eventId: string) => {
    setActiveEventId(eventId);
  };

  const handleEndAudit = () => {
    setActiveEventId(null);
  };

  const handleFinishAndCloseAudit = async (duration: string) => {
    if (activeEventId) {
      try {
        const eventRef = doc(db, 'events', activeEventId);
        await updateDoc(eventRef, {
          status: 'PASSIVE',
          completionDuration: duration
        });
        setActiveEventId(null);
      } catch (e) {
        console.error("Error finishing audit: ", e);
      }
    }
  };

  const handleScan = async (entry: ScanEntry) => {
    try {
      const timestamp = Date.now();
      const uniqueId = `${entry.eventId}_${entry.citizen.tc}_${timestamp}`;
      const entryWithUniqueId = { ...entry, id: uniqueId, serverTimestamp: timestamp };

      // 1. OPTIMISTIC LOCAL UPDATE (Instant UI, Zero Reads)
      setScannedEntries(prev => ({
        ...prev,
        [entry.eventId]: [entryWithUniqueId, ...(prev[entry.eventId] || [])]
      }));
      setEvents(prev => prev.map(e => e.id === entry.eventId ? { ...e, currentCount: e.currentCount + 1 } : e));

      // 2. Write to Firestore in background (only writes, no reads triggered)
      await setDoc(doc(db, 'scanned_entries', uniqueId), entryWithUniqueId);
      const userKey = entry.recordedBy || 'Bilinmiyor';
      await updateDoc(doc(db, 'events', entry.eventId), {
        currentCount: increment(1),
        [`userCounts.${userKey}`]: increment(1)
      });
    } catch (e) {
      console.error("Error adding scan: ", e);
    }
  };

  const handleBulkScan = async (newEntries: ScanEntry[]) => {
    if (newEntries.length === 0) return;
    const eventId = newEntries[0].eventId;

    // 1. OPTIMISTIC LOCAL UPDATE (Instant UI, Zero Reads)
    setScannedEntries(prev => ({
      ...prev,
      [eventId]: [...newEntries, ...(prev[eventId] || [])]
    }));
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, currentCount: e.currentCount + newEntries.length } : e));

    try {
      const batch = writeBatch(db);

      newEntries.forEach(entry => {
        const ref = doc(db, 'scanned_entries', entry.id);
        batch.set(ref, entry);
      });

      const event = events.find(e => e.id === eventId);
      if (event) {
        const eventRef = doc(db, 'events', eventId);
        const batchUserStats: Record<string, number> = {};
        newEntries.forEach(e => {
          const user = e.recordedBy || 'Bilinmiyor';
          batchUserStats[user] = (batchUserStats[user] || 0) + 1;
        });

        const updates: any = { currentCount: increment(newEntries.length) };
        Object.entries(batchUserStats).forEach(([user, count]) => {
          updates[`userCounts.${user}`] = increment(count);
        });
        batch.update(eventRef, updates);
      }

      await batch.commit();
    } catch (e) {
      console.error("Error bulk scanning: ", e);
    }
  };

  const handleDeleteScan = async (entry: ScanEntry) => {
    if (!activeEventId) return;

    // 1. OPTIMISTIC LOCAL UPDATE (Instant UI, Zero Reads)
    setScannedEntries(prev => ({
      ...prev,
      [activeEventId]: (prev[activeEventId] || []).filter(e => e.id !== entry.id)
    }));
    setEvents(prev => prev.map(e => e.id === activeEventId ? { ...e, currentCount: Math.max(0, e.currentCount - 1) } : e));

    try {
      // 2. Write to Firestore in background
      await deleteDoc(doc(db, 'scanned_entries', entry.id));
      const userKey = entry.recordedBy || 'Bilinmiyor';
      await updateDoc(doc(db, 'events', activeEventId), {
        currentCount: increment(-1),
        [`userCounts.${userKey}`]: increment(-1)
      });
    } catch (e) {
      console.error("Error deleting scan: ", e);
    }
  };

  const handleDatabaseUpdate = (freshDatabase: Citizen[]) => {
    // This logic handles retroactive updates for "Not Found" records
    // We iterate through all scanned entries in Firestore that have name "Veri Tabanında"
    // and if found in fresh DB, we update them.

    // Flatten all entries
    Object.values(scannedEntries).flat().forEach(async (entry) => {
      if (entry.citizen.name === 'Veri Tabanında' && entry.citizen.surname === 'Bulunamadı') {
        const foundInDb = freshDatabase.find(c => c.tc === entry.citizen.tc);
        if (foundInDb) {
          // Update Firestore
          try {
            await updateDoc(doc(db, 'scanned_entries', entry.id), {
              citizen: foundInDb
            });
          } catch (e) {
            console.error("Error auto-updating citizen: ", e);
          }
        }
      }
    });
  };

  // Refresh Passive Data (On-Demand)
  const refreshPassiveData = async (eventIds: string[]) => {
    if (eventIds.length === 0) return;

    try {
      const chunks = [];
      for (let i = 0; i < eventIds.length; i += 10) {
        chunks.push(eventIds.slice(i, i + 10));
      }

      const newEntries: ScanEntry[] = [];

      for (const chunk of chunks) {
        const q = query(collection(db, 'scanned_entries'), where('eventId', 'in', chunk));
        const snap = await getDocs(q);
        newEntries.push(...snap.docs.map(d => d.data() as ScanEntry));
      }

      setScannedEntries(prev => {
        const next = { ...prev };
        // Reset entries for requested events to ensure clean update
        eventIds.forEach(eid => next[eid] = []);

        newEntries.forEach(entry => {
          if (!next[entry.eventId]) next[entry.eventId] = [];
          next[entry.eventId].push(entry);
        });
        // Update Cache with new passive data
        const currentCacheStr = localStorage.getItem('geds_scanned_entries_cache');
        let cacheToUpdate = currentCacheStr ? JSON.parse(currentCacheStr) : {};
        // Clear requested keys in cache first (or just overwrite)
        eventIds.forEach(eid => cacheToUpdate[eid] = []);
        newEntries.forEach(entry => {
          cacheToUpdate[entry.eventId].push(entry);
        });
        try {
          localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(cacheToUpdate));
          localStorage.setItem('geds_cache_timestamp', Date.now().toString());
        } catch (storageError) {
          if (storageError instanceof DOMException && (storageError.name === 'QuotaExceededError' || storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            console.warn("⚠️ LocalStorage dolu! Eski veriler temizleniyor...");
            localStorage.removeItem('geds_scanned_entries_cache'); // Clear other cache to make room
            try {
              localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(cacheToUpdate));
            } catch (innerError) {
              console.error("❌ Veritabanı çok büyük, belleğe sığmıyor.");
            }
          }
        }
        // Update timestamp on manual refresh
        console.log(`✅ Cached updated passive data for ${eventIds.length} events`);

        return next;
      });
    } catch (e) {
      console.error("Error refreshing passive data:", e);
    }
  };

  const handleAddUser = async (user: User) => {
    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (e) {
      console.error("Error adding user: ", e);
    }
  }

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
    } catch (e) {
      console.error("Error updating user: ", e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      if (session.currentUser?.id === userId) {
        alert("Kendinizi silemezsiniz!");
        return;
      }
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.error("Error deleting user: ", e);
    }
  };

  // --- Render Logic ---

  if (!session.isAuthenticated || !session.currentUser) {
    return (
      <Login
        users={users}
        isLoading={isUsersLoading}
        onLogin={handleLogin}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onRefreshUsers={async () => await loadUsersFromFirebase(true)}
      />
    );
  }

  if (activeEventId) {
    const activeEvent = events.find(e => e.id === activeEventId);
    if (!activeEvent) return <div>Hata: Etkinlik bulunamadı veya silindi.</div>;

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
        onCheckConflict={checkCitizenshipConflict}
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
      onDeleteUser={handleDeleteUser}
      onUpdateEvent={handleUpdateEvent}
      isDarkMode={isDarkMode}
      onToggleTheme={toggleTheme}
      onRefreshPassiveData={refreshPassiveData}
    />
  );
};

export default App;