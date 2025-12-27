import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AuditScreen from './components/AuditScreen';
import HelpGuide from './components/HelpGuide';
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
  query,
  orderBy,
  writeBatch,
  where,
  getDocs,
  limit
} from 'firebase/firestore';

const App: React.FC = () => {
  // --- Global State ---
  // Session state'ini localStorage'dan yükle
  const [session, setSession] = useState<SessionState>(() => {
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('geds_session');
      if (savedSession) {
        try {
          return JSON.parse(savedSession);
        } catch (e) {
          console.error('Error parsing saved session:', e);
        }
      }
    }
    return {
      isAuthenticated: false,
      currentUser: null,
    };
  });

  const [events, setEvents] = useState<Event[]>(() => {
    // Önce localStorage'dan cache'lenmiş events'i yükle
    if (typeof window !== 'undefined') {
      const cachedEvents = localStorage.getItem('geds_events_cache');
      if (cachedEvents) {
        try {
          return JSON.parse(cachedEvents);
        } catch (e) {
          console.error('Error parsing cached events:', e);
        }
      }
    }
    return [];
  });
  const [users, setUsers] = useState<User[]>([]);
  const [scannedEntries, setScannedEntries] = useState<Record<string, ScanEntry[]>>(() => {
    // Önce localStorage'dan cache'lenmiş scanned entries'i yükle
    if (typeof window !== 'undefined') {
      const cachedEntries = localStorage.getItem('geds_scanned_cache');
      if (cachedEntries) {
        try {
          return JSON.parse(cachedEntries);
        } catch (e) {
          console.error('Error parsing cached scanned entries:', e);
        }
      }
    }
    return {};
  });

  // Pasif etkinlikleri ayrı state'te tut (sadece gerektiğinde yüklenecek)
  // Cache stratejisi: 24 saatte bir güncelle, son 50 etkinliği göster
  const [passiveEvents, setPassiveEvents] = useState<Event[]>(() => {
    if (typeof window !== 'undefined') {
      const cachedPassive = localStorage.getItem('geds_passive_cache');
      if (cachedPassive) {
        try {
          return JSON.parse(cachedPassive);
        } catch (e) {
          console.error('Error parsing cached passive events:', e);
        }
      }
    }
    return [];
  });
  const [passiveEventsLoaded, setPassiveEventsLoaded] = useState(false);
  const [totalPassiveCount, setTotalPassiveCount] = useState(0); // Toplam pasif etkinlik sayısı

  // Loading state - artık gerek yok, cache kullanıyoruz
  // const [isLoadingData, setIsLoadingData] = useState(true);

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
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  // Help Guide State
  const [isHelpGuideOpen, setIsHelpGuideOpen] = useState(false);

  // --- Firestore Subscriptions (OPTIMIZED WITH CACHE) ---

  // 1. Users - 12 HOUR CACHE (Login için gerekli ama optimize edildi)
  useEffect(() => {
    const USERS_CACHE_KEY = 'geds_users_cache';
    const USERS_CACHE_TIMESTAMP_KEY = 'geds_users_cache_timestamp';
    const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 saat

    const loadUsers = async () => {
      // Check cache first
      const cachedTimestamp = localStorage.getItem(USERS_CACHE_TIMESTAMP_KEY);
      const cachedData = localStorage.getItem(USERS_CACHE_KEY);

      if (cachedTimestamp && cachedData) {
        const cacheAge = Date.now() - parseInt(cachedTimestamp);
        if (cacheAge < CACHE_DURATION) {
          console.log(`✅ Using cached users (age: ${Math.floor(cacheAge / 1000 / 60)} minutes)`);
          try {
            const cached = JSON.parse(cachedData);
            setUsers(cached);
            return;
          } catch (e) {
            console.error('Error parsing cached users:', e);
          }
        }
      }

      // Cache expired or doesn't exist, fetch from Firebase
      console.log('🔄 Loading users from Firebase (cache expired)...');
      try {
        const q = query(collection(db, 'users'), orderBy('username', 'asc'));
        const snapshot = await getDocs(q);
        const fetchedUsers: User[] = snapshot.docs.map(doc => doc.data() as User);

        // Seed Initial Users if DB is empty
        if (fetchedUsers.length === 0) {
          console.log("🌱 Seeding initial users to Firestore...");
          for (const user of INITIAL_USERS) {
            await setDoc(doc(db, 'users', user.id), user);
          }
          setUsers(INITIAL_USERS);
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(INITIAL_USERS));
          localStorage.setItem(USERS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          console.log("✅ Initial users seeded and cached");
        } else {
          setUsers(fetchedUsers);
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(fetchedUsers));
          localStorage.setItem(USERS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          console.log(`✅ Users loaded and cached: ${fetchedUsers.length} (valid for 12 hours)`);
        }
      } catch (error: any) {
        console.error("❌ Firebase Users Error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
          alert('⚠️ Firebase Limit Aşıldı!\n\nKullanıcı verileri yüklenemedi.');
        } else if (error.code === 'permission-denied') {
          alert('⚠️ Firebase İzin Hatası!\n\nGeçici çözüm: Initial users yüklendi.');
          setUsers(INITIAL_USERS);
        }
      }
    };

    loadUsers();
  }, []); // Sadece mount'ta çalış

  // 2. Events - 12 HOUR CACHE (Sadece authenticated kullanıcılar için)
  useEffect(() => {
    // Login olmamışsa Firebase'e bağlanma
    if (!session.isAuthenticated) {
      console.log('⏸️ Not authenticated, skipping Events loading');
      return;
    }

    const EVENTS_CACHE_KEY = 'geds_events_cache';
    const EVENTS_CACHE_TIMESTAMP_KEY = 'geds_events_cache_timestamp';
    const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 saat

    const loadEvents = async () => {
      // Check cache first
      const cachedTimestamp = localStorage.getItem(EVENTS_CACHE_TIMESTAMP_KEY);
      const cachedData = localStorage.getItem(EVENTS_CACHE_KEY);

      if (cachedTimestamp && cachedData) {
        const cacheAge = Date.now() - parseInt(cachedTimestamp);
        if (cacheAge < CACHE_DURATION) {
          console.log(`✅ Using cached events (age: ${Math.floor(cacheAge / 1000 / 60)} minutes)`);
          try {
            const cached = JSON.parse(cachedData);
            setEvents(cached);
            return;
          } catch (e) {
            console.error('Error parsing cached events:', e);
          }
        }
      }

      // Cache expired or doesn't exist, fetch from Firebase
      console.log('🔄 Loading events from Firebase (cache expired)...');
      try {
        const q = collection(db, 'events');
        const snapshot = await getDocs(q);
        const fetchedEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

        // Seed Initial Events if DB is empty
        if (fetchedEvents.length === 0) {
          console.log("🌱 Seeding initial events to Firestore...");
          for (const event of INITIAL_EVENTS) {
            await setDoc(doc(db, 'events', event.id), event);
          }
          setEvents(INITIAL_EVENTS);
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(INITIAL_EVENTS));
          localStorage.setItem(EVENTS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          console.log("✅ Initial events seeded and cached");
        } else {
          setEvents(fetchedEvents);
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(fetchedEvents));
          localStorage.setItem(EVENTS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          console.log(`✅ Events loaded and cached: ${fetchedEvents.length} (valid for 12 hours)`);
        }
      } catch (error: any) {
        console.error("❌ Firebase Events Error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
          alert('⚠️ Firebase Limit Aşıldı!\n\nEtkinlik verileri yüklenemedi.');
        } else if (error.code === 'permission-denied') {
          alert('⚠️ Firebase İzin Hatası!\n\nGeçici çözüm: Initial events yüklendi.');
          setEvents(INITIAL_EVENTS);
        }
      }
    };

    loadEvents();
  }, [session.isAuthenticated]); // session.isAuthenticated değiştiğinde çalış

  // 3. Scanned Entries - OPTIMIZED (Sadece ACTIVE/IN_PROGRESS etkinlikler için)
  // PASSIVE etkinliklerin kayıtları loadPassiveEvents() ile lazy loading yapılacak
  useEffect(() => {
    // Login olmamışsa Firebase'e bağlanma
    if (!session.isAuthenticated) {
      console.log('⏸️ Not authenticated, skipping Scanned Entries subscription');
      return;
    }

    // Sadece ACTIVE ve IN_PROGRESS etkinliklerin ID'lerini al
    const activeEventIds = events
      .filter(e => e.status !== 'PASSIVE')
      .map(e => e.id);

    if (activeEventIds.length === 0) {
      console.log('⏸️ No active events, skipping Scanned Entries subscription');
      return;
    }

    console.log(`🔄 Starting Scanned Entries subscription for ${activeEventIds.length} ACTIVE events...`);

    // Sadece aktif etkinliklerin kayıtlarını dinle
    const q = query(
      collection(db, 'scanned_entries'),
      where('eventId', 'in', activeEventIds.slice(0, 10)), // Firebase 'in' limiti: max 10
      orderBy('id', 'desc')
    );

    // Debounce timer for localStorage writes
    let saveTimer: NodeJS.Timeout | null = null;

    const unsubEntries = onSnapshot(
      q,
      (snapshot) => {
        // Check if data is from cache or server
        const source = snapshot.metadata.fromCache ? 'cache' : 'server';
        console.log(`📊 Scanned entries loaded from ${source}: ${snapshot.docs.length} entries (ACTIVE events only)`);

        const fetchedEntries: ScanEntry[] = snapshot.docs.map(doc => doc.data() as ScanEntry);

        // Group by eventId
        const grouped: Record<string, ScanEntry[]> = {};
        fetchedEntries.forEach(entry => {
          if (!grouped[entry.eventId]) {
            grouped[entry.eventId] = [];
          }
          grouped[entry.eventId].push(entry);
        });

        // Mevcut cache'deki PASSIVE etkinlik kayıtlarını koru
        setScannedEntries(prev => {
          const updated = { ...prev };
          // Yeni aktif etkinlik kayıtlarını ekle/güncelle
          Object.keys(grouped).forEach(eventId => {
            updated[eventId] = grouped[eventId];
          });
          return updated;
        });

        // Debounced localStorage write (sadece server'dan gelen veriler için)
        if (source === 'server') {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            setScannedEntries(current => {
              localStorage.setItem('geds_scanned_cache', JSON.stringify(current));
              console.log('💾 Scanned entries cached to localStorage');
              return current;
            });
          }, 1000); // 1 saniye bekle
        }
      },
      (error) => {
        console.error("❌ Firebase Scanned Entries Error:", error);

        // Firebase quota aşımı kontrolü
        if (error.code === 'resource-exhausted' || error.message.includes('quota')) {
          alert('⚠️ Firebase Limit Aşıldı!\n\nKaydedilen TC\'ler görüntülenemiyor.\n\nNot: Yeni kayıtlar eklenebilir ancak mevcut kayıtlar görüntülenemez.');
        } else {
          alert(`Firebase Bağlantı Hatası: ${error.message}`);
        }

        // Hata durumunda cache'den yükle
        const cachedEntries = localStorage.getItem('geds_scanned_cache');
        if (cachedEntries) {
          try {
            setScannedEntries(JSON.parse(cachedEntries));
          } catch (e) {
            console.error('Error parsing cached scanned entries:', e);
          }
        }
      }
    );

    return () => {
      unsubEntries();
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [session.isAuthenticated, events]); // events değiştiğinde de çalış (ACTIVE/PASSIVE geçişleri için)

  // --- Handlers (Now using Firestore) ---

  // Pasif etkinlikleri yükle (sadece gerektiğinde çağrılır)
  // forceRefresh: true ise cache'i yoksay ve Firebase'den çek
  const loadPassiveEvents = async (forceRefresh = false) => {
    const CACHE_KEY = 'geds_passive_cache';
    const CACHE_TIMESTAMP_KEY = 'geds_passive_cache_timestamp';
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 gün (milisaniye)
    const PASSIVE_EVENTS_LIMIT = 35; // Son 35 pasif etkinlik

    // Cache kontrolü - eğer forceRefresh değilse ve cache geçerliyse, cache'den yükle
    if (!forceRefresh) {
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      const cachedData = localStorage.getItem(CACHE_KEY);

      if (cachedTimestamp && cachedData) {
        const cacheAge = Date.now() - parseInt(cachedTimestamp);

        if (cacheAge < CACHE_DURATION) {
          // Cache hala geçerli, Firebase'den çekme
          console.log(`✅ Using cached passive events (age: ${Math.floor(cacheAge / 1000 / 60)} minutes)`);
          try {
            const cached = JSON.parse(cachedData);

            // Cache'den TÜM etkinlikleri göster
            setPassiveEvents(cached);
            setTotalPassiveCount(cached.length); // Cache'deki toplam sayı
            setPassiveEventsLoaded(true);
            console.log(`📊 Loaded ${cached.length} cached passive events (from cache, no Firebase read)`);
            return;
          } catch (e) {
            console.error('Error parsing cached data:', e);
            // Cache bozuksa devam et ve Firebase'den çek
          }
        } else {
          console.log(`🕐 Cache expired (age: ${Math.floor(cacheAge / 1000 / 60 / 60)} hours), fetching fresh data...`);
        }
      }
    } else {
      console.log('🔄 Force refresh requested, fetching fresh data from Firebase...');
    }

    // Cache geçersiz veya forceRefresh=true, Firebase'den çek
    console.log(`🔄 Loading passive events from Firebase...`);

    try {
      // TÜM PASSIVE etkinlikleri al (client-side sıralama yapacağız)
      const q = query(
        collection(db, 'events'),
        where('status', '==', 'PASSIVE')
      );

      const snapshot = await getDocs(q);
      let allPassive: Event[] = snapshot.docs.map(doc => doc.data() as Event);

      const actualTotalCount = allPassive.length;
      console.log(`📊 Total PASSIVE events in database: ${actualTotalCount}`);

      // Client-side sıralama: closedAt'e göre (en yeni önce)
      // closedAt yoksa endDate kullan (eski etkinlikler için)
      allPassive.sort((a, b) => {
        const aTime = a.closedAt || new Date(a.endDate).getTime() || 0;
        const bTime = b.closedAt || new Date(b.endDate).getTime() || 0;
        return bTime - aTime; // Descending (en yeni önce)
      });

      // TÜM pasif etkinlikleri göster
      const fetchedPassive = allPassive;

      // Sadece ilk 35'inin scanned_entries'lerini yükleyeceğiz
      const SCANNED_ENTRIES_LIMIT = 35;

      // Toplam sayıyı gerçek değerle güncelle
      setTotalPassiveCount(actualTotalCount);
      setPassiveEvents(fetchedPassive);
      setPassiveEventsLoaded(true);

      console.log(`📊 Loaded ${fetchedPassive.length} passive events (will load scanned entries for first ${SCANNED_ENTRIES_LIMIT})`);

      // 2. Bu pasif etkinliklerin scanned_entries kayıtlarını da yükle
      console.log('🔄 Loading scanned entries for passive events...');
      const eventIdsToLoad = fetchedPassive.slice(0, SCANNED_ENTRIES_LIMIT).map(e => e.id);

      if (eventIdsToLoad.length > 0) {
        // Önce hangi etkinliklerin scanned entries'i eksik kontrol et
        const missingEventIds = eventIdsToLoad.filter(eventId => {
          const existingEntries = scannedEntries[eventId];
          return !existingEntries || existingEntries.length === 0;
        });

        console.log(`📊 Events with missing scanned entries: ${missingEventIds.length} of ${eventIdsToLoad.length} (loading only first ${SCANNED_ENTRIES_LIMIT})`);

        // BATCH OPTIMIZATION: 5 etkinlik gruplarında yükle (10'dan azaltıldı)
        const BATCH_SIZE = 5;
        const allScanned: ScanEntry[] = [];

        for (let i = 0; i < eventIdsToLoad.length; i += BATCH_SIZE) {
          const batchIds = eventIdsToLoad.slice(i, i + BATCH_SIZE);
          console.log(`🔄 Loading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(eventIdsToLoad.length / BATCH_SIZE)} (${batchIds.length} events)...`);

          // Batch içindeki tüm etkinlikler için tek sorguda çek
          const scansQuery = query(
            collection(db, 'scanned_entries'),
            where('eventId', 'in', batchIds)
          );
          const scansSnapshot = await getDocs(scansQuery);
          const batchScans = scansSnapshot.docs.map(doc => doc.data() as ScanEntry);
          allScanned.push(...batchScans);

          // Rate limiting: Her batch arasında kısa bekleme
          if (i + BATCH_SIZE < eventIdsToLoad.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Mevcut scannedEntries ile birleştir
        setScannedEntries(prev => {
          const updated = { ...prev };
          allScanned.forEach(entry => {
            if (!updated[entry.eventId]) {
              updated[entry.eventId] = [];
            }
            // Duplicate kontrolü
            if (!updated[entry.eventId].find(e => e.id === entry.id)) {
              updated[entry.eventId].push(entry);
            }
          });
          // Cache'i güncelle
          localStorage.setItem('geds_scanned_cache', JSON.stringify(updated));
          return updated;
        });

        console.log(`✅ Loaded scanned entries for ${eventIdsToLoad.length} passive events (${allScanned.length} total entries)`);
      }

      // Cache'e kaydet (yeni verilerle) + timestamp
      localStorage.setItem(CACHE_KEY, JSON.stringify(fetchedPassive));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`✅ Cached ${fetchedPassive.length} passive events (valid for 24 hours)`);
    } catch (error: any) {
      console.error('❌ Error loading passive events:', error);
      if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
        alert('⚠️ Firebase Limit Aşıldı!\n\nPasif etkinlikler yüklenemedi.');
      }
    }
  };

  // Belirli bir etkinlik için tüm kayıtları yükle (lazy loading)
  const loadOlderEntriesForEvent = async (eventId: string) => {
    try {
      console.log(`🔄 Loading all entries for event: ${eventId}...`);
      const scansQuery = query(
        collection(db, 'scanned_entries'),
        where('eventId', '==', eventId)
      );
      const scansSnapshot = await getDocs(scansQuery);
      const entries = scansSnapshot.docs.map(doc => doc.data() as ScanEntry);

      setScannedEntries(prev => {
        const updated = { ...prev };
        updated[eventId] = entries;
        // Cache'i güncelle
        localStorage.setItem('geds_scanned_cache', JSON.stringify(updated));
        return updated;
      });

      console.log(`✅ Loaded ${entries.length} entries for event ${eventId}`);
      return entries.length;
    } catch (error) {
      console.error('❌ Error loading older entries:', error);
      return 0;
    }
  };

  const handleLogin = (user: User) => {
    const newSession = {
      isAuthenticated: true,
      currentUser: user,
    };
    setSession(newSession);
    // Session'ı localStorage'a kaydet
    localStorage.setItem('geds_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession({
      isAuthenticated: false,
      currentUser: null,
    });
    setActiveEventId(null);
    // Session'ı localStorage'dan temizle
    localStorage.removeItem('geds_session');
  };

  const handleAddEvent = async (event: Event) => {
    console.log('📝 handleAddEvent called with:', event);
    try {
      // Remove undefined fields (Firebase doesn't accept undefined)
      const cleanEvent = Object.fromEntries(
        Object.entries(event).filter(([_, value]) => value !== undefined)
      );
      await setDoc(doc(db, 'events', event.id), cleanEvent);
      console.log('✅ Event saved to Firebase:', event.id);
    } catch (e) {
      console.error("❌ Error adding event: ", e);
      alert('Etkinlik eklenirken hata oluştu: ' + (e as Error).message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));

      // Silinen etkinliği passiveEvents state'inden de kaldır
      setPassiveEvents(prev => {
        const updated = prev.filter(e => e.id !== id);
        // Cache'i de güncelle
        localStorage.setItem('geds_passive_cache', JSON.stringify(updated));
        return updated;
      });

      // Toplam pasif etkinlik sayısını da güncelle
      setTotalPassiveCount(prev => Math.max(0, prev - 1));

      // Optionally delete related scans (batch delete usually required for many docs)
    } catch (e) {
      console.error("Error deleting event: ", e);
    }
  };

  const handleReactivateEvent = async (id: string) => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, {
        status: 'ACTIVE',
        completionDuration: null // Remove field (or use deleteField())
      });
    } catch (e) {
      console.error("Error reactivating event: ", e);
    }
  };

  const handleStartAudit = (eventId: string, companyId?: string) => {
    setActiveEventId(eventId);
    setActiveCompanyId(companyId || null);
  };

  const handleEndAudit = async (shouldAutoComplete?: { targetReached: boolean; startTime: number }) => {
    if (shouldAutoComplete?.targetReached && activeEventId) {
      try {
        // Calculate duration
        const diff = Date.now() - shouldAutoComplete.startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        const formattedDuration = [
          hours.toString().padStart(2, '0'),
          minutes.toString().padStart(2, '0'),
          seconds.toString().padStart(2, '0')
        ].join(':');

        // Set event to PASSIVE
        const eventRef = doc(db, 'events', activeEventId);
        await updateDoc(eventRef, {
          status: 'PASSIVE',
          completionDuration: formattedDuration,
          closedAt: Date.now() // Kapatılma zamanı
        });
      } catch (e) {
        console.error("Error auto-completing audit: ", e);
      }
    }
    setActiveEventId(null);
  };

  const handleFinishAndCloseAudit = async (duration: string) => {
    console.log('🏁 Finishing audit for event:', activeEventId, 'Duration:', duration);
    if (activeEventId) {
      try {
        const eventRef = doc(db, 'events', activeEventId);
        await updateDoc(eventRef, {
          status: 'PASSIVE',
          completionDuration: duration,
          closedAt: Date.now() // Kapatılma zamanı
        });
        console.log('✅ Event marked as PASSIVE:', activeEventId);

        // Pasif etkinlikleri otomatik yükle (eğer henüz yüklenmemişse)
        if (!passiveEventsLoaded) {
          console.log('🔄 Auto-loading passive events...');
          await loadPassiveEvents();
        } else {
          // Eğer zaten yüklenmişse, sadece listeye ekle
          const finishedEvent = events.find(e => e.id === activeEventId);
          if (finishedEvent) {
            const updatedEvent = {
              ...finishedEvent,
              status: 'PASSIVE' as const,
              completionDuration: duration
            };
            setPassiveEvents(prev => [updatedEvent, ...prev]);
            console.log('✅ Added to passive events list');
          }
        }

        setActiveEventId(null);
      } catch (e) {
        console.error("❌ Error finishing audit: ", e);
        alert('Denetim bitirilemedi: ' + (e as Error).message);
      }
    } else {
      console.warn('⚠️ No active event ID found');
    }
  };

  const handleScan = async (entry: ScanEntry) => {
    try {
      // 1. SERVER-SIDE VALIDATION: Check current count before saving
      const event = events.find(e => e.id === entry.eventId);
      if (!event) {
        throw new Error('Etkinlik bulunamadı');
      }

      // Get current scanned entries count from Firebase
      const scansQuery = query(
        collection(db, 'scanned_entries'),
        where('eventId', '==', entry.eventId)
      );
      const scansSnapshot = await getDocs(scansQuery);
      const currentScannedCount = scansSnapshot.size;

      // Check if target is reached
      const targetCount = event.targetCount;
      if (currentScannedCount >= targetCount) {
        throw new Error(`Hedef sayıya ulaşıldı! (${currentScannedCount}/${targetCount}). Daha fazla kayıt yapılamaz.`);
      }

      // 2. Add Entry - Remove undefined fields before sending to Firestore
      const cleanEntry = Object.fromEntries(
        Object.entries(entry).filter(([_, value]) => value !== undefined)
      );
      await setDoc(doc(db, 'scanned_entries', entry.id), cleanEntry);

      console.log('✅ TC başarıyla kaydedildi:', entry.citizen.tc);
    } catch (e: any) {
      console.error("❌ Error adding scan: ", e);

      // Firebase quota aşımı kontrolü
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        alert('⚠️ Firebase Ücretsiz Limit Aşıldı!\n\nTC okutuldu ancak kaydedilemedi.\n\nÇözüm: Firebase projenizi Blaze (Kullandıkça Öde) planına yükseltin.\n\nNot: Yeni kayıtlar eklenemez.');
      } else if (e.code === 'permission-denied') {
        alert('⚠️ Yetki Hatası!\n\nFirebase yazma izni yok. Firestore Rules kontrol edin.');
      } else {
        alert(`⚠️ Kayıt Hatası!\n\nTC okutuldu ancak kaydedilemedi.\n\nHata: ${e.message || 'Bilinmeyen hata'}`);
      }
    }
  };

  const handleBulkScan = async (newEntries: ScanEntry[]) => {
    if (newEntries.length === 0) return;
    const eventId = newEntries[0].eventId;

    try {
      // SERVER-SIDE VALIDATION: Check current count before saving
      const event = events.find(e => e.id === eventId);
      if (!event) {
        throw new Error('Etkinlik bulunamadı');
      }

      // Get current scanned entries count from Firebase
      const scansQuery = query(
        collection(db, 'scanned_entries'),
        where('eventId', '==', eventId)
      );
      const scansSnapshot = await getDocs(scansQuery);
      const currentScannedCount = scansSnapshot.size;

      // Check if adding these entries would exceed target
      const targetCount = event.targetCount;
      const newTotal = currentScannedCount + newEntries.length;
      if (newTotal > targetCount) {
        throw new Error(`Hedef sayı aşılıyor! Mevcut: ${currentScannedCount}, Eklenecek: ${newEntries.length}, Hedef: ${targetCount}`);
      }

      const batch = writeBatch(db);

      // Add all entries
      newEntries.forEach(entry => {
        const ref = doc(db, 'scanned_entries', entry.id);
        // Remove undefined fields before sending to Firestore
        const cleanEntry = Object.fromEntries(
          Object.entries(entry).filter(([_, value]) => value !== undefined)
        );
        batch.set(ref, cleanEntry);
      });

      await batch.commit();
      console.log(`✅ ${newEntries.length} TC başarıyla kaydedildi`);
    } catch (e: any) {
      console.error("❌ Error bulk scanning: ", e);

      // Firebase quota aşımı kontrolü
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        alert(`⚠️ Firebase Ücretsiz Limit Aşıldı!\n\n${newEntries.length} TC okutuldu ancak kaydedilemedi.\n\nÇözüm: Firebase projenizi Blaze planına yükseltin.`);
      } else if (e.code === 'permission-denied') {
        alert('⚠️ Yetki Hatası!\n\nFirebase yazma izni yok.');
      } else {
        alert(`⚠️ Toplu Kayıt Hatası!\n\n${newEntries.length} TC kaydedilemedi.\n\nHata: ${e.message || 'Bilinmeyen hata'}`);
      }
    }
  };

  const handleDeleteScan = async (entryId: string) => {
    if (!activeEventId) return;

    try {
      // 1. Delete Entry
      await deleteDoc(doc(db, 'scanned_entries', entryId));

      // 2. Decrement Event Count
      const event = events.find(e => e.id === activeEventId);
      if (event) {
        await updateDoc(doc(db, 'events', activeEventId), {
          currentCount: Math.max(0, event.currentCount - 1)
        });
      }
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
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.error("Error deleting user: ", e);
    }
  };

  const handleUpdateEvent = async (updatedEvent: Event) => {
    try {
      // Remove undefined fields (Firebase doesn't accept undefined)
      const cleanEvent = Object.fromEntries(
        Object.entries(updatedEvent).filter(([_, value]) => value !== undefined)
      );
      await setDoc(doc(db, 'events', updatedEvent.id), cleanEvent);
    } catch (e) {
      console.error("Error updating event: ", e);
    }
  };

  const handleCleanDuplicates = async (eventId: string) => {
    if (!window.confirm('Bu etkinlikteki mükerrer kayıtları temizlemek istediğinize emin misiniz?\n\nAynı TC\'ye sahip kayıtlardan sadece ilki korunacak, diğerleri silinecek.')) {
      return;
    }

    try {
      console.log('🔄 Cleaning duplicates for event:', eventId);

      // Get all entries for this event
      const q = query(
        collection(db, 'scanned_entries'),
        where('eventId', '==', eventId)
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScanEntry & { id: string }));

      console.log(`📊 Total entries: ${entries.length}`);

      // Group by TC number
      const tcGroups: Record<string, (ScanEntry & { id: string })[]> = {};
      entries.forEach(entry => {
        const tc = entry.citizen.tc;
        if (!tcGroups[tc]) {
          tcGroups[tc] = [];
        }
        tcGroups[tc].push(entry);
      });

      // Find duplicates
      const duplicatesToDelete: string[] = [];
      Object.entries(tcGroups).forEach(([tc, group]) => {
        if (group.length > 1) {
          // Keep the first one, delete the rest
          console.log(`🔍 Found ${group.length} entries for TC ${tc}`);
          for (let i = 1; i < group.length; i++) {
            duplicatesToDelete.push(group[i].id);
          }
        }
      });

      if (duplicatesToDelete.length === 0) {
        alert('✅ Bu etkinlikte mükerrer kayıt bulunamadı.');
        return;
      }

      console.log(`🗑️ Deleting ${duplicatesToDelete.length} duplicate entries...`);

      // Delete duplicates in batches
      const batch = writeBatch(db);
      duplicatesToDelete.forEach(id => {
        batch.delete(doc(db, 'scanned_entries', id));
      });

      await batch.commit();

      console.log(`✅ Deleted ${duplicatesToDelete.length} duplicate entries`);
      alert(`✅ ${duplicatesToDelete.length} mükerrer kayıt temizlendi!\n\nKalan benzersiz kayıt: ${entries.length - duplicatesToDelete.length}`);
    } catch (e: any) {
      console.error('❌ Error cleaning duplicates:', e);
      alert('Hata: ' + (e.message || e));
    }
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
    if (!activeEvent) {
      // Etkinlik bulunamadı - muhtemelen PASSIVE'e geçti, ana ekrana dön
      setTimeout(() => setActiveEventId(null), 100);
      return null; // Boş ekran göster (çok kısa süre)
    }

    // Şirket varsa o şirkete ait company bilgisini bul
    const activeCompany = activeCompanyId
      ? activeEvent.companies?.find(c => c.id === activeCompanyId)
      : undefined;

    // Scanned entries'i filtrele
    // Eğer şirket seçilmişse:
    // - O şirkete ait kayıtları göster (entry.companyId === activeCompanyId)
    // - VEYA companyId'si olmayan kayıtları da göster (geriye dönük uyumluluk için)
    const currentList = activeCompanyId
      ? (scannedEntries[activeEventId] || []).filter(entry =>
        entry.companyId === activeCompanyId || !entry.companyId
      )
      : scannedEntries[activeEventId] || [];

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
        activeCompanyId={activeCompanyId}
        activeCompany={activeCompany}
      />
    );
  }

  return (
    <>
      {/* Help Guide Modal */}
      <HelpGuide
        isOpen={isHelpGuideOpen}
        onClose={() => setIsHelpGuideOpen(false)}
      />

      <AdminDashboard
        currentUser={session.currentUser}
        events={events}
        passiveEvents={passiveEvents}
        totalPassiveCount={totalPassiveCount}
        onLoadPassiveEvents={loadPassiveEvents}
        onLoadOlderEntriesForEvent={loadOlderEntriesForEvent}
        users={users}
        scannedEntries={scannedEntries}
        onLogout={handleLogout}
        onStartAudit={handleStartAudit}
        onAddEvent={handleAddEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
        onReactivateEvent={handleReactivateEvent}
        onAddUser={handleAddUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
        onCleanDuplicates={handleCleanDuplicates}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onOpenHelpGuide={() => setIsHelpGuideOpen(true)}
      />
    </>
  );
};

export default App;