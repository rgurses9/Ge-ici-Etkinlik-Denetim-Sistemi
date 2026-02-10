import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // Ref to access latest events without triggering re-renders in effects
  const eventsRef = useRef<Event[]>(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // Flag to track if scanned entries have been loaded from cache already
  const scannedEntriesCacheLoaded = useRef(false);

  // Per-event fetch timestamp tracker: eventId -> last fetch time (ms)
  // If data was fetched within SCAN_CACHE_TTL, skip Firestore read
  const eventFetchTimestamps = useRef<Record<string, number>>({});
  const SCAN_CACHE_TTL = 10 * 60 * 1000; // 10 dakika

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
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(() => {
    return localStorage.getItem('geds_active_company_name');
  });

  // Persist activeEventId changes
  useEffect(() => {
    if (activeEventId) {
      localStorage.setItem('geds_active_event_id', activeEventId);
    } else {
      localStorage.removeItem('geds_active_event_id');
    }
    if (activeCompanyName) {
      localStorage.setItem('geds_active_company_name', activeCompanyName);
    } else {
      localStorage.removeItem('geds_active_company_name');
    }
  }, [activeEventId, activeCompanyName]);

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

  // 1. Users Loading (Cache-First with 30-min TTL)
  useEffect(() => {
    const USERS_TTL = 30 * 60 * 1000; // 30 dakika
    const loadUsers = async () => {
      const cachedUsers = localStorage.getItem('geds_users_cache');
      if (cachedUsers) {
        setUsers(JSON.parse(cachedUsers));
        setIsUsersLoading(false);
      }

      // TTL kontrolü: Son 30 dakika içinde çekildiyse Firestore'a gitme
      const lastFetch = localStorage.getItem('geds_users_fetch_ts');
      if (lastFetch && cachedUsers && (Date.now() - Number(lastFetch)) < USERS_TTL) {
        console.log('👤 Users cache taze (30dk dolmadı), Firestore sorgusu atlandı.');
        setIsUsersLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        const fetchedUsers: User[] = snapshot.docs.map(doc => doc.data() as User);

        if (fetchedUsers.length > 0) {
          setUsers(fetchedUsers);
          localStorage.setItem('geds_users_cache', JSON.stringify(fetchedUsers));
          localStorage.setItem('geds_users_fetch_ts', Date.now().toString());
        }
      } catch (e) {
        console.warn("Users fetch from server failed, relying on cache.", e);
      } finally {
        setIsUsersLoading(false);
      }
    };
    loadUsers();
  }, []);

  // 2. Events Loading (Cache-First with 30-min TTL)
  useEffect(() => {
    if (!session.isAuthenticated) return;
    const EVENTS_TTL = 30 * 60 * 1000; // 30 dakika

    const loadEventsOnce = async () => {
      try {
        // Cache'den yükle (anında UI)
        const cachedEvents = localStorage.getItem('geds_events_cache');
        if (cachedEvents) {
          setEvents(JSON.parse(cachedEvents));
        }

        // TTL kontrolü: Son 30 dakika içinde çekildiyse Firestore'a gitme
        const lastFetch = localStorage.getItem('geds_events_fetch_ts');
        if (lastFetch && cachedEvents && (Date.now() - Number(lastFetch)) < EVENTS_TTL) {
          console.log('📋 Events cache taze (30dk dolmadı), Firestore sorgusu atlandı.');
          return;
        }

        console.log('📡 Fetching events from server...');
        const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
        const snapshot = await getDocs(q);
        const fetchedEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

        setEvents(fetchedEvents);
        localStorage.setItem('geds_events_cache', JSON.stringify(fetchedEvents));
        localStorage.setItem('geds_events_fetch_ts', Date.now().toString());
        console.log(`✅ Events loaded: ${fetchedEvents.length}`);
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

  // 2.5. Auto-Load Passive Event Data for Admins (24-hour cache)
  const passiveAutoLoadDone = useRef(false);
  useEffect(() => {
    if (!session.isAuthenticated || !session.currentUser) return;
    if (!session.currentUser.roles.includes('ADMIN' as any)) return;
    if (events.length === 0) return;
    if (passiveAutoLoadDone.current) return;
    passiveAutoLoadDone.current = true;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const lastTimestamp = localStorage.getItem('geds_passive_cache_timestamp');
    const now = Date.now();

    // Cache hâlâ taze mi? (24 saat içinde)
    if (lastTimestamp && (now - Number(lastTimestamp)) < TWENTY_FOUR_HOURS) {
      console.log('📋 Pasif veriler cache\'de taze (24 saat dolmadı), Firestore sorgusu yapılmadı.');
      return;
    }

    // Son 35 pasif etkinliği bul ve verilerini yükle
    const passiveEvents = events
      .filter(e => e.status === 'PASSIVE')
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
      .slice(0, 35);

    if (passiveEvents.length === 0) return;

    const passiveEventIds = passiveEvents.map(e => e.id);
    console.log(`📡 Admin: Son ${passiveEventIds.length} pasif etkinliğin verileri otomatik yükleniyor...`);

    // Arka planda yükle (UI bloklamaz)
    (async () => {
      try {
        const allEntries: ScanEntry[] = [];
        for (let i = 0; i < passiveEventIds.length; i += 10) {
          const chunk = passiveEventIds.slice(i, i + 10);
          const q = query(collection(db, 'scanned_entries'), where('eventId', 'in', chunk));
          const snap = await getDocs(q);
          allEntries.push(...snap.docs.map(d => d.data() as ScanEntry));
        }

        // State'e ekle
        setScannedEntries(prev => {
          const next = { ...prev };
          passiveEventIds.forEach(eid => next[eid] = []);
          allEntries.forEach(entry => {
            if (!next[entry.eventId]) next[entry.eventId] = [];
            next[entry.eventId].push(entry);
          });
          return next;
        });

        // Cache güncelle
        try {
          const currentCacheStr = localStorage.getItem('geds_scanned_entries_cache');
          let cache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
          passiveEventIds.forEach(eid => cache[eid] = []);
          allEntries.forEach(entry => {
            if (!cache[entry.eventId]) cache[entry.eventId] = [];
            cache[entry.eventId].push(entry);
          });
          localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(cache));
          localStorage.setItem('geds_passive_cache_timestamp', now.toString());
          console.log(`✅ Admin: ${passiveEventIds.length} pasif etkinliğin verileri cache'e yazıldı (24 saat geçerli).`);
        } catch (e) {
          console.warn('Pasif veri cache hatası:', e);
        }
      } catch (e) {
        console.error('Pasif veri otomatik yükleme hatası:', e);
      }
    })();
  }, [session.isAuthenticated, session.currentUser, events]);

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
    if (scannedEntriesCacheLoaded.current) return; // Prevent duplicate load

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
    scannedEntriesCacheLoaded.current = true;
  }, [session.isAuthenticated]);

  // B. Scanned Entries (Load current event + overlapping events)
  // CRITICAL: 'events' is NOT in the dependency array to avoid re-fetching on every scan.
  // We use eventsRef.current to access events without causing re-triggers.
  useEffect(() => {
    if (!session.isAuthenticated) {
      setScannedEntries({});
      scannedEntriesCacheLoaded.current = false;
      return;
    }

    const loadScannedEntries = async () => {
      try {
        if (!activeEventId) {
          // DASHBOARD MODE: Cache was already loaded in effect A above.
          return;
        }

        // AUDIT MODE: Cache-first with TTL check
        const cachedEntriesStr = localStorage.getItem('geds_scanned_entries_cache');

        // 1. Cache'den anında göster
        if (cachedEntriesStr) {
          const cached = JSON.parse(cachedEntriesStr);
          if (cached[activeEventId]) {
            setScannedEntries(prev => ({ ...prev, [activeEventId]: cached[activeEventId] }));
          }
        }

        // 2. TTL kontrolü: Bu etkinlik son 10 dakika içinde Firestore'dan çekildiyse tekrar çekme
        const lastFetchTime = eventFetchTimestamps.current[activeEventId] || 0;
        if ((Date.now() - lastFetchTime) < SCAN_CACHE_TTL) {
          console.log(`⚡ Etkinlik ${activeEventId} verileri cache'de taze (10dk dolmadı), Firestore sorgusu atlandı.`);
          return;
        }

        // 3. Firestore'dan çek (cache süresi dolmuş veya ilk kez)
        const currentEvents = eventsRef.current;
        const currentEvent = currentEvents.find(e => e.id === activeEventId);
        if (!currentEvent) return;

        const currentStart = new Date(currentEvent.startDate).getTime();
        const currentEnd = new Date(currentEvent.endDate).getTime();

        const overlappingEventIds = currentEvents
          .filter(e => {
            if (e.id === activeEventId) return true;
            const eStart = new Date(e.startDate).getTime();
            const eEnd = new Date(e.endDate).getTime();
            return currentStart < eEnd && currentEnd > eStart;
          })
          .map(e => e.id);

        console.log(`📡 Loading scans for ${overlappingEventIds.length} overlapping events (Firestore READ)`);

        const allEntries: Record<string, ScanEntry[]> = {};

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

        if (allEntries[activeEventId]) {
          allEntries[activeEventId].sort((a, b) =>
            (Number(b.serverTimestamp) || 0) - (Number(a.serverTimestamp) || 0)
          );
        }

        setScannedEntries(allEntries);

        // Fetch timestamp'lerini güncelle (tüm overlapping events için)
        const now = Date.now();
        overlappingEventIds.forEach(eid => {
          eventFetchTimestamps.current[eid] = now;
        });

        // Cache güncelle
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
  }, [session.isAuthenticated, activeEventId]);

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

  const handleStartAudit = (eventId: string, companyName?: string) => {
    setActiveEventId(eventId);
    setActiveCompanyName(companyName || null);
  };

  const handleEndAudit = () => {
    setActiveEventId(null);
    setActiveCompanyName(null);
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
          localStorage.setItem('geds_passive_cache_timestamp', Date.now().toString());
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
    // Optimistic Update (no need to re-read users collection)
    setUsers(prev => [...prev, user]);
    try {
      await setDoc(doc(db, 'users', user.id), user);
      // Update cache
      localStorage.setItem('geds_users_cache', JSON.stringify([...users, user]));
    } catch (e) {
      console.error("Error adding user: ", e);
      // Rollback
      setUsers(prev => prev.filter(u => u.id !== user.id));
    }
  }

  const handleUpdateUser = async (updatedUser: User) => {
    // Optimistic Update
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    try {
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
      // Update cache
      const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
      localStorage.setItem('geds_users_cache', JSON.stringify(updatedUsers));
    } catch (e) {
      console.error("Error updating user: ", e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (session.currentUser?.id === userId) {
      alert("Kendinizi silemezsiniz!");
      return;
    }
    // Optimistic Update
    const previousUsers = users;
    setUsers(prev => prev.filter(u => u.id !== userId));
    try {
      await deleteDoc(doc(db, 'users', userId));
      // Update cache
      localStorage.setItem('geds_users_cache', JSON.stringify(users.filter(u => u.id !== userId)));
    } catch (e) {
      console.error("Error deleting user: ", e);
      // Rollback
      setUsers(previousUsers);
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
        activeCompanyName={activeCompanyName}
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