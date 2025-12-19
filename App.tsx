import React, { useState, useEffect } from 'react';
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
  query,
  orderBy,
  writeBatch,
  limit,
  where,
  getDocs
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
  const [passiveEvents, setPassiveEvents] = useState<Event[]>(() => {
    // Önce localStorage'dan cache'lenmiş passive events'i yükle
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

  // --- Firestore Subscriptions ---

  // 1. Users Subscription & Initial Seeding
  // HER ZAMAN çalıştır (login için gerekli!)
  useEffect(() => {
    console.log('🔄 Starting Users subscription (required for login)...');
    const q = query(collection(db, 'users'), orderBy('username', 'asc'));
    const unsubUsers = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUsers: User[] = snapshot.docs.map(doc => doc.data() as User);

        // Seed Initial Users if DB is empty
        if (fetchedUsers.length === 0) {
          console.log("🌱 Seeding initial users to Firestore...");
          INITIAL_USERS.forEach(async (user) => {
            await setDoc(doc(db, 'users', user.id), user);
          });
          // Seed işlemi sırasında da kullanıcıları state'e ekle
          setUsers(INITIAL_USERS);
          console.log("✅ Initial users seeded and loaded:", INITIAL_USERS.length);
        } else {
          setUsers(fetchedUsers);
          console.log("✅ Users loaded from Firestore:", fetchedUsers.length);
        }
      },
      (error) => {
        console.error("❌ Firebase Users Error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
          alert('⚠️ Firebase Ücretsiz Limit Aşıldı!\n\nKullanıcı verileri yüklenemedi.');
        } else if (error.code === 'permission-denied') {
          alert('⚠️ Firebase İzin Hatası!\n\nFirestore Rules kontrol edin.\n\nGeçici çözüm: Initial users yüklendi.');
          // İzin hatası durumunda initial users'ı yükle
          setUsers(INITIAL_USERS);
        }
        // Diğer hatalarda boş array
        if (error.code !== 'permission-denied') {
          setUsers([]);
        }
      }
    );

    return () => unsubUsers();
  }, []); // Sadece mount'ta çalış

  // 2. Events Subscription & Initial Seeding
  // SADECE authenticated kullanıcılar için çalıştır (reads azaltmak için)
  useEffect(() => {
    // Login olmamışsa Firebase'e bağlanma
    if (!session.isAuthenticated) {
      console.log('⏸️ Not authenticated, skipping Events subscription');
      return;
    }

    console.log('🔄 Starting Events subscription (ACTIVE/IN_PROGRESS only)...');
    // SADECE ACTIVE ve IN_PROGRESS etkinlikleri çek (reads azaltmak için)
    const q = query(
      collection(db, 'events'),
      where('status', 'in', ['ACTIVE', 'IN_PROGRESS'])
    );
    const unsubEvents = onSnapshot(
      q,
      (snapshot) => {
        const fetchedEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

        // Seed Initial Events if DB is empty
        if (fetchedEvents.length === 0) {
          console.log("🌱 Seeding initial events to Firestore...");
          INITIAL_EVENTS.forEach(async (event) => {
            await setDoc(doc(db, 'events', event.id), event);
          });
          // Seed işlemi sırasında da events'i state'e ekle
          setEvents(INITIAL_EVENTS);
          console.log("✅ Initial events seeded and loaded:", INITIAL_EVENTS.length);
        } else {
          setEvents(fetchedEvents);
          console.log("✅ Events loaded from Firestore:", fetchedEvents.length);
        }
        // Events'ı localStorage'a cache'le
        localStorage.setItem('geds_events_cache', JSON.stringify(fetchedEvents.length > 0 ? fetchedEvents : INITIAL_EVENTS));
      },
      (error) => {
        console.error("❌ Firebase Events Error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
          alert('⚠️ Firebase Ücretsiz Limit Aşıldı!\n\nEtkinlik verileri yüklenemedi.');
        } else if (error.code === 'permission-denied') {
          alert('⚠️ Firebase İzin Hatası!\n\nFirestore Rules kontrol edin.\n\nGeçici çözüm: Initial events yüklendi.');
          setEvents(INITIAL_EVENTS);
        }
        // Diğer hatalarda boş array
        if (error.code !== 'permission-denied') {
          setEvents([]);
        }
        // Hata durumunda cache'i temizleme (eski veriler görünsün)
      }
    );

    return () => unsubEvents();
  }, [session.isAuthenticated]); // session.isAuthenticated değiştiğinde çalış

  // 3. Scanned Entries Subscription
  // SADECE authenticated kullanıcılar için çalıştır (reads azaltmak için)
  useEffect(() => {
    // Login olmamışsa Firebase'e bağlanma
    if (!session.isAuthenticated) {
      console.log('⏸️ Not authenticated, skipping Scanned Entries subscription');
      return;
    }

    console.log('🔄 Starting Scanned Entries subscription (ALL ENTRIES)...');
    // TÜM kayıtları çek (limit kaldırıldı)
    const q = query(
      collection(db, 'scanned_entries'),
      orderBy('id', 'desc')
    );
    const unsubEntries = onSnapshot(
      q,
      (snapshot) => {
        const fetchedEntries: ScanEntry[] = snapshot.docs.map(doc => doc.data() as ScanEntry);

        // Group by eventId
        const grouped: Record<string, ScanEntry[]> = {};
        fetchedEntries.forEach(entry => {
          if (!grouped[entry.eventId]) {
            grouped[entry.eventId] = [];
          }
          grouped[entry.eventId].push(entry);
        });

        setScannedEntries(grouped);
        // Scanned entries'i localStorage'a cache'le
        localStorage.setItem('geds_scanned_cache', JSON.stringify(grouped));
      },
      (error) => {
        console.error("❌ Firebase Scanned Entries Error:", error);

        // Firebase quota aşımı kontrolü
        if (error.code === 'resource-exhausted' || error.message.includes('quota')) {
          alert('⚠️ Firebase Ücretsiz Limit Aşıldı!\n\nKaydedilen TC\'ler görüntülenemiyor.\n\nÇözüm: Firebase projenizi Blaze (Kullandıkça Öde) planına yükseltin.\n\nNot: Yeni kayıtlar eklenebilir ancak mevcut kayıtlar görüntülenemez.');
        } else {
          alert(`Firebase Bağlantı Hatası: ${error.message}`);
        }

        // Hata durumunda boş veri göster
        setScannedEntries({});
      }
    );

    return () => unsubEntries();
  }, [session.isAuthenticated]); // session.isAuthenticated değiştiğinde çalış

  // 4. Cache'den yüklenen pasif etkinlikler için scanned entries'i yükle
  useEffect(() => {
    // Login olmamışsa veya pasif etkinlik yoksa çalışma
    if (!session.isAuthenticated || passiveEvents.length === 0 || passiveEventsLoaded) {
      return;
    }

    console.log('🔄 Loading scanned entries for cached passive events...');

    const loadCachedPassiveScans = async () => {
      try {
        const eventIds = passiveEvents.map(e => e.id);

        // Hangi etkinliklerin scanned entries'i eksik kontrol et
        const missingEventIds = eventIds.filter(eventId => {
          const existingEntries = scannedEntries[eventId];
          return !existingEntries || existingEntries.length === 0;
        });

        if (missingEventIds.length === 0) {
          console.log('✅ All cached passive events already have scanned entries');
          return;
        }

        console.log(`📊 Loading scanned entries for ${missingEventIds.length} cached passive events...`);

        // Sadece eksik olanlar için scanned_entries'i çek
        const scannedEntriesPromises = missingEventIds.map(async (eventId) => {
          const scansQuery = query(
            collection(db, 'scanned_entries'),
            where('eventId', '==', eventId)
          );
          const scansSnapshot = await getDocs(scansQuery);
          return scansSnapshot.docs.map(doc => doc.data() as ScanEntry);
        });

        const allScannedArrays = await Promise.all(scannedEntriesPromises);
        const allScanned = allScannedArrays.flat();

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

        console.log(`✅ Loaded scanned entries for ${missingEventIds.length} cached passive events (${allScanned.length} total entries)`);
      } catch (error) {
        console.error('❌ Error loading cached passive scans:', error);
      }
    };

    loadCachedPassiveScans();
  }, [session.isAuthenticated, passiveEvents.length]); // passiveEvents değiştiğinde çalış

  // --- Handlers (Now using Firestore) ---

  // Pasif etkinlikleri yükle (sadece gerektiğinde çağrılır)
  const loadPassiveEvents = async () => {
    if (passiveEventsLoaded) {
      console.log('⏸️ Passive events already loaded, skipping...');
      return;
    }

    console.log('🔄 Loading ALL passive events...');
    try {
      // 1. TÜM pasif etkinlikleri al (tarih sınırlaması YOK)
      const q = query(
        collection(db, 'events'),
        where('status', '==', 'PASSIVE')
        // orderBy kaldırıldı - client-side sıralama yapılacak
      );

      const snapshot = await getDocs(q);
      // Client-side sorting by endDate (descending)
      const fetchedPassive: Event[] = snapshot.docs
        .map(doc => doc.data() as Event)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      const totalCount = fetchedPassive.length;

      setTotalPassiveCount(totalCount);
      setPassiveEvents(fetchedPassive);
      setPassiveEventsLoaded(true);

      console.log(`📊 Total passive events loaded: ${totalCount}`);

      // 2. Bu pasif etkinliklerin scanned_entries kayıtlarını da yükle
      console.log('🔄 Loading scanned entries for all passive events...');
      const eventIds = fetchedPassive.map(e => e.id);

      if (eventIds.length > 0) {
        // Önce hangi etkinliklerin scanned entries'i eksik kontrol et
        const missingEventIds = eventIds.filter(eventId => {
          const existingEntries = scannedEntries[eventId];
          return !existingEntries || existingEntries.length === 0;
        });

        console.log(`📊 Events with missing scanned entries: ${missingEventIds.length} of ${eventIds.length}`);

        // Tüm etkinlikler için scanned_entries'i çek (eksik olanlar için de yükle)
        const scannedEntriesPromises = eventIds.map(async (eventId) => {
          const scansQuery = query(
            collection(db, 'scanned_entries'),
            where('eventId', '==', eventId)
          );
          const scansSnapshot = await getDocs(scansQuery);
          return scansSnapshot.docs.map(doc => doc.data() as ScanEntry);
        });

        const allScannedArrays = await Promise.all(scannedEntriesPromises);
        const allScanned = allScannedArrays.flat();

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

        console.log(`✅ Loaded scanned entries for ${eventIds.length} passive events (${allScanned.length} total entries)`);
      }

      // Cache'e kaydet
      localStorage.setItem('geds_passive_cache', JSON.stringify(fetchedPassive));
      console.log(`✅ All passive events loaded: ${fetchedPassive.length} total`);
    } catch (error: any) {
      console.error('❌ Error loading passive events:', error);
      if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
        alert('⚠️ Firebase Limit Aşıldı!\n\nPasif etkinlikler yüklenemedi.');
      }
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
          completionDuration: formattedDuration
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
          completionDuration: duration
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
    if (!activeEvent) return <div>Hata: Etkinlik bulunamadı veya silindi.</div>;

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
    <AdminDashboard
      currentUser={session.currentUser}
      events={events}
      passiveEvents={passiveEvents}
      totalPassiveCount={totalPassiveCount}
      onLoadPassiveEvents={loadPassiveEvents}
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
    />
  );
};

export default App;