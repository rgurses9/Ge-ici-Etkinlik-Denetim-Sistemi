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
  const [session, setSession] = useState<SessionState>({
    isAuthenticated: false,
    currentUser: null,
  });

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  // --- Firestore Subscriptions ---

  // 1. Users Subscription & Initial Seeding
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('username', 'asc'));
    const unsubUsers = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUsers: User[] = snapshot.docs.map(doc => doc.data() as User);

        // Seed Initial Users if DB is empty
        if (fetchedUsers.length === 0) {
          console.log("Seeding initial users to Firestore...");
          INITIAL_USERS.forEach(async (user) => {
            await setDoc(doc(db, 'users', user.id), user);
          });
        } else {
          setUsers(fetchedUsers);
        }
      },
      (error) => {
        console.error("❌ Firebase Users Error:", error);
        if (error.code === 'resource-exhausted' || error.message.includes('quota')) {
          alert('⚠️ Firebase Ücretsiz Limit Aşıldı!\n\nKullanıcı verileri yüklenemedi.');
        }
        setUsers([]);
      }
    );

    return () => unsubUsers();
  }, []);

  // 2. Events Subscription & Initial Seeding
  useEffect(() => {
    const unsubEvents = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        const fetchedEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

        // Seed Initial Events if DB is empty
        if (fetchedEvents.length === 0) {
          console.log("Seeding initial events to Firestore...");
          INITIAL_EVENTS.forEach(async (event) => {
            await setDoc(doc(db, 'events', event.id), event);
          });
        } else {
          setEvents(fetchedEvents);
        }
      },
      (error) => {
        console.error("❌ Firebase Events Error:", error);
        if (error.code === 'resource-exhausted' || error.message.includes('quota')) {
          alert('⚠️ Firebase Ücretsiz Limit Aşıldı!\n\nEtkinlik verileri yüklenemedi.');
        }
        setEvents([]);
      }
    );

    return () => unsubEvents();
  }, []);

  // 3. Scanned Entries Subscription
  useEffect(() => {
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
  }, []);

  // --- Handlers (Now using Firestore) ---

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
      // 1. Add Entry
      await setDoc(doc(db, 'scanned_entries', entry.id), entry);

      // 2. Increment Event Count (Optimistic or Transactional could be better, but simple update works here)
      const event = events.find(e => e.id === entry.eventId);
      if (event) {
        await updateDoc(doc(db, 'events', entry.eventId), {
          currentCount: event.currentCount + 1
        });
      }
    } catch (e) {
      console.error("Error adding scan: ", e);
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
        batch.set(ref, entry);
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
    } catch (e) {
      console.error("Error bulk scanning: ", e);
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