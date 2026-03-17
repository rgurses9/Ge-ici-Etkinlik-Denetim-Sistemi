import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers, useAddUser, useUpdateUser, useDeleteUser, usePassiveEvents } from './hooks/useFirestoreQueries';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AuditScreen from './components/AuditScreen';
import { User, Event, ScanEntry, SessionState, Citizen } from './types';
import { INITIAL_USERS, INITIAL_EVENTS } from './constants';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  writeBatch,
  getDocs,
  getDocsFromCache,
  where,
  increment,
  limit
} from 'firebase/firestore';

// Yardımcı: Önce Firestore IndexedDB cache'inden oku, başarısız olursa sunucudan çek
const getDocsCacheFirst = async (q: any) => {
  try {
    const cached = await getDocsFromCache(q);
    if (!cached.empty) {
      console.log(`📦 Cache'den okundu (${cached.size} doküman)`);
      return cached;
    }
  } catch (e) {
    // Cache boş veya hata — sunucudan çek
  }
  console.log('🌐 Sunucudan çekiliyor...');
  return getDocs(q);
};

const APP_VERSION = '1.0.1'; // Sürümü güncelleyerek tüm kullanıcılarda otomatik önbellek temizliği ve güncelleme tetikleyebilirsiniz

const App: React.FC = () => {
  // --- Global State (önce tanımlanmalı) ---
  const [session, setSession] = useState<SessionState>(() => {
    // Sürüm Kontrolü (Otomatik Güncelleme Mekanizması)
    const storedVersion = localStorage.getItem('geds_app_version');
    if (storedVersion !== APP_VERSION) {
      console.warn(`Yeni sürüm tespit edildi! (${storedVersion} -> ${APP_VERSION}). Önbellekler temizleniyor...`);
      localStorage.removeItem('geds_events_cache');
      localStorage.removeItem('geds_scanned_entries_cache');
      localStorage.removeItem('geds_worker_db_v3_compressed');
      localStorage.removeItem('geds_worker_db_time_v3');
      localStorage.setItem('geds_app_version', APP_VERSION);

      // Cache'leri temizledikten sonra yeni verilerle başlatmak üzere sayfayı yeniliyoruz
      if (typeof window !== 'undefined' && storedVersion !== null) {
        window.location.reload();
      }
    }

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

  // --- TanStack Query ---
  const queryClient = useQueryClient();

  // Users - TanStack Query ile yönetiliyor (24 saat cache)
  const { data: users = [], isLoading: isUsersLoading, refetch: refetchUsers } = useUsers();
  const addUserMutation = useAddUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  // Passive Events - TanStack Query ile yönetiliyor (2 saat cache)
  // Sadece authenticated kullanıcılar için aktif
  const { data: passiveEvents = [], refetch: refetchPassiveEvents } = usePassiveEvents(!!session.isAuthenticated);

  const [events, setEvents] = useState<Event[]>([]);
  const [scannedEntries, setScannedEntries] = useState<Record<string, ScanEntry[]>>({});

  // Ref to access latest events without triggering re-renders in effects
  const eventsRef = useRef<Event[]>(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // Flag to track if scanned entries have been loaded from cache already
  const scannedEntriesCacheLoaded = useRef(false);

  // Per-event fetch timestamp tracker: eventId -> last fetch time (ms)
  // If data was fetched within SCAN_CACHE_TTL, skip Firestore read
  const eventFetchTimestamps = useRef<Record<string, number>>({});
  const SCAN_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 saat

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
  const activeEventCache = useRef<Event | null>(null);

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

  // Refresh users function (TanStack Query ile)
  const loadUsersFromFirebase = async (forceRefresh = false) => {
    console.log('🔄 Refreshing users from Firebase (force)...');
    try {
      await refetchUsers();
      console.log(`✅ Users refreshed`);
    } catch (error: any) {
      console.error("❌ Error refreshing users:", error);
      throw error;
    }
  };

  // 2. Events Loading — Real-time listener SADECE ACTIVE events için
  // Passive events TanStack Query ile yönetiliyor
  useEffect(() => {
    if (!session.isAuthenticated) return;

    // Cache'den anında göster (tüm events)
    const cachedEvents = localStorage.getItem('geds_events_cache');
    if (cachedEvents) {
      try {
        setEvents(JSON.parse(cachedEvents));
      } catch (e) { /* silent */ }
    }

    // Real-time listener: SADECE ACTIVE events
    console.log('📡 Events real-time listener başlatılıyor (sadece ACTIVE)...');
    const q = query(
      collection(db, 'events'),
      where('status', '==', 'ACTIVE'),
      orderBy('startDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const activeEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

      // Passive events'i TanStack Query'den al
      const allEvents = [...activeEvents, ...passiveEvents].sort((a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      setEvents(allEvents);
      localStorage.setItem('geds_events_cache', JSON.stringify(allEvents));
      console.log(`✅ Events güncellendi (real-time): ${activeEvents.length} active, ${passiveEvents.length} passive`);
    }, (error) => {
      console.error('Events listener error:', error);
    });

    return () => {
      console.log('🔌 Events listener kapatıldı.');
      unsubscribe();
    };
  }, [session.isAuthenticated, passiveEvents]);

  // Auto-sync events to cache (ensures optimistic updates persist across page refreshes)
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('geds_events_cache', JSON.stringify(events));
    }
  }, [events]);

  // 2.5. Pasif verilerin otomatik yüklenmesi KALDIRILDI — okuma sayısını düşürmek için.
  // Pasif veriler artık sadece kullanıcı "Yenile" butonuna bastığında (refreshPassiveData) yüklenecek.
  // Bu değişiklik admin girişinde binlerce gereksiz Firestore okumasını engeller.

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

  // B. Scanned Entries (Load current event + overlapping events) - OPTIMIZED
  // CRITICAL: 'events' is NOT in the dependency array to avoid re-fetching on every scan.
  // We use eventsRef.current to access events without causing re-triggers.
  useEffect(() => {
    if (!session.isAuthenticated) {
      setScannedEntries({});
      scannedEntriesCacheLoaded.current = false;
      return;
    }

    if (!activeEventId) {
      // DASHBOARD MODE: No listener needed
      return;
    }

    // AUDIT MODE: Real-time listener ONLY for active event
    const setupListener = async () => {
      try {
        // 1. Cache'den anında göster
        const cachedEntriesStr = localStorage.getItem('geds_scanned_entries_cache');
        if (cachedEntriesStr) {
          const cached = JSON.parse(cachedEntriesStr);
          if (cached[activeEventId]) {
            setScannedEntries(prev => ({ ...prev, [activeEventId]: cached[activeEventId] }));
          }
        }

        // 2. Overlapping events'leri bul (sadece conflict check için)
        const currentEvents = eventsRef.current;
        const currentEvent = currentEvents.find(e => e.id === activeEventId);
        if (!currentEvent) return () => { };

        const currentStart = new Date(currentEvent.startDate).getTime();
        const currentEnd = new Date(currentEvent.endDate).getTime();

        const overlappingEventIds = currentEvents
          .filter(e => {
            if (e.id === activeEventId) return false; // Aktif event hariç
            const eStart = new Date(e.startDate).getTime();
            const eEnd = new Date(e.endDate).getTime();
            return currentStart < eEnd && currentEnd > eStart;
          })
          .map(e => e.id);

        // 3. Overlapping events için cache-first yükleme (real-time değil)
        if (overlappingEventIds.length > 0) {
          console.log(`📦 Loading ${overlappingEventIds.length} overlapping events from cache/Firestore (one-time)...`);

          for (const eventId of overlappingEventIds) {
            // Önce cache'den dene
            if (cachedEntriesStr) {
              const cached = JSON.parse(cachedEntriesStr);
              if (cached[eventId]) {
                setScannedEntries(prev => ({ ...prev, [eventId]: cached[eventId] }));
                continue; // Cache'de varsa Firestore'a gitme
              }
            }

            // Cache'de yoksa Firestore'dan bir kez çek (real-time değil)
            const q = query(
              collection(db, 'scanned_entries'),
              where('eventId', '==', eventId),
              orderBy('serverTimestamp', 'desc'),
              limit(200) // Overlapping events için yeterli (conflict check)
            );

            const snapshot = await getDocs(q); // One-time read, NOT real-time
            const entries = snapshot.docs.map(d => d.data() as ScanEntry);

            setScannedEntries(prev => ({ ...prev, [eventId]: entries }));

            // Cache'e kaydet
            try {
              const cache = localStorage.getItem('geds_scanned_entries_cache');
              const newCache = cache ? JSON.parse(cache) : {};
              newCache[eventId] = entries;
              localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(newCache));
            } catch (e) { }
          }
        }

        // 4. SADECE ACTIVE EVENT için real-time listener (OPTIMIZED)
        console.log(`📡 Setting up real-time listener for ACTIVE event only...`);

        const qConstraints: any[] = [
          where('eventId', '==', activeEventId),
          orderBy('serverTimestamp', 'desc'),
          limit(200) // OPTIMIZED: 1500'den 200'e düşürüldü (87% okuma azalması)
        ];

        if (activeCompanyName) {
          qConstraints.splice(1, 0, where('companyName', '==', activeCompanyName));
        }

        const q = query(
          collection(db, 'scanned_entries'),
          ...qConstraints
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          // OPTIMIZED: Process only changes, not entire dataset
          snapshot.docChanges().forEach((change) => {
            const entry = change.doc.data() as ScanEntry;

            if (change.type === 'added') {
              // DUPLICATE PREVENTION: Check if entry already exists in local state
              // This prevents double-counting when optimistic update is followed by Firestore listener
              setScannedEntries(prev => {
                const existingList = prev[activeEventId] || [];
                const alreadyExists = existingList.some(e => e.id === entry.id);

                if (alreadyExists) {
                  console.log(`⚠️ Duplicate prevented: ${entry.id} already in local state`);
                  return prev; // Don't add duplicate
                }

                return {
                  ...prev,
                  [activeEventId]: [entry, ...existingList].slice(0, 200)
                };
              });
            } else if (change.type === 'modified') {
              setScannedEntries(prev => ({
                ...prev,
                [activeEventId]: (prev[activeEventId] || []).map(e =>
                  e.id === entry.id ? entry : e
                )
              }));
            } else if (change.type === 'removed') {
              setScannedEntries(prev => ({
                ...prev,
                [activeEventId]: (prev[activeEventId] || []).filter(e => e.id !== entry.id)
              }));
            }
          });

          console.log(`✅ Active scans updated: ${snapshot.docChanges().length} changes`);

          // Update cache
          try {
            const cache = localStorage.getItem('geds_scanned_entries_cache');
            const newCache = cache ? JSON.parse(cache) : {};
            newCache[activeEventId] = snapshot.docs.map(d => d.data() as ScanEntry);
            localStorage.setItem('geds_scanned_entries_cache', JSON.stringify(newCache));
          } catch (e) { }
        }, (error) => {
          console.error(`Listener error (${activeEventId}):`, error);
        });

        // Cleanup
        return () => {
          console.log('🔌 Listener closed.');
          unsubscribe();
        };

      } catch (e) {
        console.error("Error setting up scan entries listener", e);
        return () => { };
      }
    };

    const cleanupPromise = setupListener();
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [session.isAuthenticated, activeEventId, activeCompanyName]);

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

  // --- Presence Tracking ---
  useEffect(() => {
    if (session.isAuthenticated && session.currentUser) {
      const userRef = doc(db, 'users', session.currentUser.id);

      const updatePresence = () => {
        updateDoc(userRef, { lastActive: Date.now() }).catch(() => { });
      };

      updatePresence(); // Giriş yapıldığında anında güncelle
      const intervalId = setInterval(updatePresence, 60000); // Her 1 dakikada bir güncelle

      const handleUnload = () => {
        updateDoc(userRef, { lastActive: 0 }).catch(() => { });
      };

      window.addEventListener('beforeunload', handleUnload);

      return () => {
        clearInterval(intervalId);
        window.removeEventListener('beforeunload', handleUnload);
        updateDoc(userRef, { lastActive: 0 }).catch(() => { });
      };
    }
  }, [session.isAuthenticated, session.currentUser]);

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

      // TanStack Query cache'ini de güncelle (Pasif etkinlikler onSnapshot'tan gelmediği için burada manuel güncellenmeli)
      if (updatedEvent.status === 'PASSIVE') {
        const currentPassive = queryClient.getQueryData<Event[]>(['passiveEvents']) || [];
        queryClient.setQueryData(['passiveEvents'], currentPassive.map(e =>
          e.id === updatedEvent.id ? { ...e, ...updatedEvent, currentCount: e.currentCount } : e
        ));
      }

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

  const handleMarkEventPassive = async (duration: string) => {
    if (activeEventId) {
      try {
        setEvents(prev => prev.map(e => e.id === activeEventId
          ? { ...e, status: 'PASSIVE' as const, completionDuration: duration }
          : e
        ));

        const eventRef = doc(db, 'events', activeEventId);
        await updateDoc(eventRef, {
          status: 'PASSIVE',
          completionDuration: duration
        });

        refetchPassiveEvents();
      } catch (e) {
        console.error("Error marking audit passive: ", e);
      }
    }
  };

  const handleFinishAndCloseAudit = async (duration: string) => {
    setActiveEventId(null);
    setActiveCompanyName(null);
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

      // Update events state locally for immediate progress bar feedback
      setEvents(prev => prev.map(e => e.id === entry.eventId ? { ...e, currentCount: (e.currentCount || 0) + 1 } : e));

      // 2. Write to Firestore in background (only writes, no reads triggered)
      // FIX: Remove undefined fields to prevent Firestore error
      const cleanEntry: any = { ...entryWithUniqueId };
      if (cleanEntry.companyName === undefined) {
        delete cleanEntry.companyName;
      }

      await setDoc(doc(db, 'scanned_entries', uniqueId), cleanEntry);

      const userKey = entry.recordedBy || 'Bilinmiyor';

      // Prepare updates object
      const updates: any = {
        currentCount: increment(1),
        [`userCounts.${userKey}`]: increment(1)
      };

      // Add company count update if available
      if (entry.companyName) {
        const safeComp = entry.companyName.replace(/\./g, '_');
        const safeUser = userKey.replace(/\./g, '_');
        updates[`companyCounts.${safeComp}`] = increment(1);
        updates[`companyUserCounts.${safeComp}__${safeUser}`] = increment(1);
      }

      await updateDoc(doc(db, 'events', entry.eventId), updates);
    } catch (e) {
      console.error("Error adding scan: ", e);
    }
  };

  const handleBulkScan = async (newEntries: ScanEntry[]) => {
    if (newEntries.length === 0) return;
    const eventId = newEntries[0].eventId;

    // 1. OPTIMISTIC LOCAL UPDATE (Instant UI, Zero Reads)
    // Entries update
    setScannedEntries(prev => ({
      ...prev,
      [eventId]: [...newEntries, ...(prev[eventId] || [])]
    }));

    // Events update (Counter) - Dashboard için anında geri bildirim
    setEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        return {
          ...e,
          currentCount: (e.currentCount || 0) + newEntries.length
        };
      }
      return e;
    }));

    try {
      const batch = writeBatch(db);

      newEntries.forEach(entry => {
        const ref = doc(db, 'scanned_entries', entry.id);

        // FIX: Remove undefined fields to prevent Firestore error
        const cleanEntry: any = { ...entry };
        if (cleanEntry.companyName === undefined) {
          delete cleanEntry.companyName;
        }

        batch.set(ref, cleanEntry);
      });

      // Event stats update (Counter logic)
      const eventRef = doc(db, 'events', eventId);

      const batchUserStats: Record<string, number> = {};
      const batchCompanyStats: Record<string, number> = {};
      const batchCompanyUserStats: Record<string, number> = {};

      newEntries.forEach(e => {
        const user = e.recordedBy || 'Bilinmiyor';
        batchUserStats[user] = (batchUserStats[user] || 0) + 1;

        if (e.companyName) {
          const safeName = e.companyName.replace(/\./g, '_');
          const safeUser = user.replace(/\./g, '_');
          batchCompanyStats[safeName] = (batchCompanyStats[safeName] || 0) + 1;
          batchCompanyUserStats[`${safeName}__${safeUser}`] = (batchCompanyUserStats[`${safeName}__${safeUser}`] || 0) + 1;
        }
      });

      const updates: any = { currentCount: increment(newEntries.length) };

      Object.entries(batchUserStats).forEach(([user, count]) => {
        updates[`userCounts.${user}`] = increment(count);
      });

      Object.entries(batchCompanyStats).forEach(([comp, count]) => {
        updates[`companyCounts.${comp}`] = increment(count);
      });

      Object.entries(batchCompanyUserStats).forEach(([key, count]) => {
        updates[`companyUserCounts.${key}`] = increment(count);
      });

      batch.update(eventRef, updates);

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

    // Update events state locally for immediate progress bar feedback
    setEvents(prev => prev.map(e => e.id === activeEventId ? { ...e, currentCount: Math.max(0, (e.currentCount || 0) - 1) } : e));

    try {
      // 2. Write to Firestore in background
      await deleteDoc(doc(db, 'scanned_entries', entry.id));

      const userKey = entry.recordedBy || 'Bilinmiyor';

      const updates: any = {
        currentCount: increment(-1),
        [`userCounts.${userKey}`]: increment(-1)
      };

      if (entry.companyName) {
        const safeComp = entry.companyName.replace(/\./g, '_');
        const safeUser = userKey.replace(/\./g, '_');
        updates[`companyCounts.${safeComp}`] = increment(-1);
        updates[`companyUserCounts.${safeComp}__${safeUser}`] = increment(-1);
      }

      await updateDoc(doc(db, 'events', activeEventId), updates);
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
    try {
      await addUserMutation.mutateAsync(user);
    } catch (e) {
      console.error("Error adding user: ", e);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      await updateUserMutation.mutateAsync(updatedUser);
    } catch (e) {
      console.error("Error updating user: ", e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (session.currentUser?.id === userId) {
      alert("Kendinizi silemezsiniz!");
      return;
    }
    try {
      await deleteUserMutation.mutateAsync(userId);
    } catch (e) {
      console.error("Error deleting user: ", e);
    }
  };

  const handleSyncEventData = async (eventId: string, silent: boolean = false) => {
    if (!silent && !confirm('Senkronizasyon işlemi veritabanındaki tüm kayıtları tarayacaktır. Devam etmek istiyor musunuz?')) return;
    try {
      // 1. Fetch all entries for this event
      const q = query(collection(db, 'scanned_entries'), where('eventId', '==', eventId));
      const snapshot = await getDocs(q);
      const allEntries = snapshot.docs.map(doc => doc.data() as ScanEntry);

      // 2. Recalculate stats
      const stats = {
        currentCount: allEntries.length,
        userCounts: {} as Record<string, number>,
        companyCounts: {} as Record<string, number>,
        companyUserCounts: {} as Record<string, number>
      };

      allEntries.forEach(entry => {
        const user = entry.recordedBy || 'Bilinmiyor';
        stats.userCounts[user] = (stats.userCounts[user] || 0) + 1;

        if (entry.companyName) {
          const safeComp = entry.companyName.replace(/\./g, '_');
          const safeUser = user.replace(/\./g, '_');
          stats.companyCounts[safeComp] = (stats.companyCounts[safeComp] || 0) + 1;
          const key = `${safeComp}__${safeUser}`;
          stats.companyUserCounts[key] = (stats.companyUserCounts[key] || 0) + 1;
        }
      });

      // 3. Update Event Doc
      await updateDoc(doc(db, 'events', eventId), stats);
      if (!silent) alert('Senkronizasyon başarıyla tamamlandı.');
    } catch (e) {
      console.error(e);
      if (!silent) alert('Hata oluştu.');
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
    let activeEvent = events.find(e => e.id === activeEventId);
    if (activeEvent) {
      activeEventCache.current = activeEvent;
    } else if (activeEventCache.current && activeEventCache.current.id === activeEventId) {
      activeEvent = activeEventCache.current;
    }

    if (!activeEvent) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
          Hata: Etkinlik bulunamadı veya silindi.
        </div>
      );
    }

    const currentList = scannedEntries[activeEventId] || [];

    return (
      <AuditScreen
        event={activeEvent}
        allEvents={events}
        currentUser={session.currentUser}
        onExit={handleEndAudit}
        onFinish={handleFinishAndCloseAudit}
        onMarkPassive={handleMarkEventPassive}
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
      onRefreshPassiveData={refreshPassiveData}
      onSyncEvent={handleSyncEventData}
      onRefreshEvents={refetchPassiveEvents}
      isDarkMode={isDarkMode}
      onToggleTheme={toggleTheme}
    />
  );
};

export default App;