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
  getDocs,
  where
} from 'firebase/firestore';

const App: React.FC = () => {
  // --- Global State ---
  const [session, setSession] = useState<SessionState>({
    isAuthenticated: false,
    currentUser: null,
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
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

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
  useEffect(() => {
    // Safety timeout: stop loading spinner after 5 seconds if Firebase is slow
    const timeoutId = setTimeout(() => {
      setIsUsersLoading((prev) => {
        if (prev) {
          console.warn("⚠️ User data loading timed out.");
          return false;
        }
        return prev;
      });
    }, 5000);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
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
      setIsUsersLoading(false);
      clearTimeout(timeoutId);
    }, (error) => {
      console.error("❌ Users listener error:", error);
      setIsUsersLoading(false);
      clearTimeout(timeoutId);
    });

    return () => {
      unsubUsers();
      clearTimeout(timeoutId);
    };
  }, []);

  // 2. Events Subscription & Initial Seeding
  useEffect(() => {
    if (!session.isAuthenticated) return;

    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
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
    });

    return () => unsubEvents();
  }, [session.isAuthenticated]);

  // Conflict Check (On-Demand)
  const checkCitizenshipConflict = async (tc: string, ignoreEventId: string): Promise<string | null> => {
    try {
      const q = query(collection(db, 'scanned_entries'), where('citizen.tc', '==', tc));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const otherScans = snapshot.docs.map(d => d.data() as ScanEntry);

      const currentEvent = events.find(e => e.id === ignoreEventId);
      if (!currentEvent) return null;

      const currentStart = new Date(currentEvent.startDate).getTime();
      const currentEnd = new Date(currentEvent.endDate).getTime();

      for (const scan of otherScans) {
        if (scan.eventId === ignoreEventId) continue;

        const otherEvent = events.find(e => e.id === scan.eventId);
        if (!otherEvent) continue;

        const otherStart = new Date(otherEvent.startDate).getTime();
        const otherEnd = new Date(otherEvent.endDate).getTime();

        if (currentStart < otherEnd && currentEnd > otherStart) {
          return `⚠️ ÇAKIŞMA: Bu kişi ilk olarak "${otherEvent.name}" etkinliğinde okutulmuştur.\nBu etkinlikte görev alıyor (${scan.recordedBy || 'Bilinmiyor'} tarafından kaydedildi). Lütfen oradaki denetlemeci ile iletişime geçiniz.`;
        }
      }

      return null;
    } catch (e) {
      console.error("Conflict check error:", e);
      return null;
    }
  };

  // 3. Optimized Scanned Entries Subscription
  useEffect(() => {
    if (!session.isAuthenticated) return;

    let targetEventIds: string[] = [];

    if (activeEventId) {
      // Audit Screen: Single Event
      targetEventIds = [activeEventId];
    } else {
      // Dashboard: Continuing Events (Active + Count > 0)
      // Limit to 10 for 'in' query safety
      targetEventIds = events
        .filter(e => e.status === 'ACTIVE' && e.currentCount > 0)
        .map(e => e.id)
        .slice(0, 10);
    }

    if (targetEventIds.length === 0) {
      setScannedEntries({});
      return;
    }

    // Firestore 'in' query allows max 10 values
    // If user has >10 continuing events, only top 10 will update live.
    // This is an optimization tradeoff.
    const q = query(
      collection(db, 'scanned_entries'),
      where('eventId', 'in', targetEventIds),
      orderBy('timestamp', 'desc')
    );

    const unsubEntries = onSnapshot(q, (snapshot) => {
      const fetchedEntries: ScanEntry[] = snapshot.docs.map(doc => doc.data() as ScanEntry);

      const grouped: Record<string, ScanEntry[]> = {};
      fetchedEntries.forEach(entry => {
        if (!grouped[entry.eventId]) {
          grouped[entry.eventId] = [];
        }
        grouped[entry.eventId].push(entry);
      });

      setScannedEntries(grouped);
    });

    return () => unsubEntries();
  }, [session.isAuthenticated, activeEventId, events]); // Re-run when event counts change (e.g. new event becomes 'continuing')

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

  const handleUpdateEvent = async (updatedEvent: Event) => {
    try {
      const eventRef = doc(db, 'events', updatedEvent.id);
      await updateDoc(eventRef, { ...updatedEvent });
    } catch (e) {
      console.error("Error updating event: ", e);
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