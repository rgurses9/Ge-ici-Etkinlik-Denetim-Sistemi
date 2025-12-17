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
  writeBatch
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

    console.log('🔄 Starting Events subscription...');
    const unsubEvents = onSnapshot(
      collection(db, 'events'),
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

    console.log('🔄 Starting Scanned Entries subscription...');
    const q = query(collection(db, 'scanned_entries'), orderBy('timestamp', 'desc'));
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

  // --- Handlers (Now using Firestore) ---

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
    try {
      await setDoc(doc(db, 'events', event.id), event);
    } catch (e) {
      console.error("Error adding event: ", e);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
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
      // 1. Add Entry - Remove undefined fields before sending to Firestore
      const cleanEntry = Object.fromEntries(
        Object.entries(entry).filter(([_, value]) => value !== undefined)
      );
      await setDoc(doc(db, 'scanned_entries', entry.id), cleanEntry);

      // 2. Increment Event Count (Optimistic or Transactional could be better, but simple update works here)
      const event = events.find(e => e.id === entry.eventId);
      if (event) {
        await updateDoc(doc(db, 'events', entry.eventId), {
          currentCount: event.currentCount + 1
        });
      }

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

      // Update event count
      const event = events.find(e => e.id === eventId);
      if (event) {
        const eventRef = doc(db, 'events', eventId);
        batch.update(eventRef, {
          currentCount: event.currentCount + newEntries.length
        });
      }

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
      await setDoc(doc(db, 'events', updatedEvent.id), updatedEvent);
    } catch (e) {
      console.error("Error updating event: ", e);
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

    // Scanned entries'i filtrele - eğer şirket seçilmişse sadece o şirketin kayıtlarını göster
    const currentList = activeCompanyId
      ? (scannedEntries[activeEventId] || []).filter(entry => entry.companyId === activeCompanyId)
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
      isDarkMode={isDarkMode}
      onToggleTheme={toggleTheme}
    />
  );
};

export default App;