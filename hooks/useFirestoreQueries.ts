import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    collection,
    query,
    orderBy,
    getDocs,
    getDocsFromCache,
    where,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocsFromServer,
    limit,
    limitToLast
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Event } from '../types';

// Yardımcı: Önce cache'den oku, başarısız olursa sunucudan çek
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

// ============================================
// USERS QUERIES
// ============================================

// Users'ı getir (24 saat cache)
export const useUsers = () => {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            console.log('🔄 Users sorgusu çalışıyor...');
            const q = query(collection(db, 'users'), orderBy('username', 'asc'));
            const snapshot = await getDocsCacheFirst(q);
            const users: User[] = snapshot.docs.map(doc => doc.data() as User);

            // LocalStorage'a da kaydet (yedek)
            if (users.length > 0) {
                localStorage.setItem('geds_users_cache', JSON.stringify(users));
                localStorage.setItem('geds_users_fetch_ts', Date.now().toString());
            }

            return users;
        },
        staleTime: 24 * 60 * 60 * 1000, // 24 saat - kullanıcılar çok nadir değişir
        gcTime: 48 * 60 * 60 * 1000, // 48 saat cache'de tut
        initialData: () => {
            // LocalStorage'dan initial data yükle
            const cached = localStorage.getItem('geds_users_cache');
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (e) {
                    return undefined;
                }
            }
            return undefined;
        },
    });
};

// User ekleme mutation
export const useAddUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (user: User) => {
            await setDoc(doc(db, 'users', user.id), user);
            return user;
        },
        onMutate: async (newUser) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ['users'] });
            const previousUsers = queryClient.getQueryData<User[]>(['users']);

            queryClient.setQueryData<User[]>(['users'], (old) =>
                old ? [...old, newUser] : [newUser]
            );

            return { previousUsers };
        },
        onError: (err, newUser, context) => {
            // Hata durumunda geri al
            if (context?.previousUsers) {
                queryClient.setQueryData(['users'], context.previousUsers);
            }
        },
        onSuccess: () => {
            // Cache'i güncelle
            const users = queryClient.getQueryData<User[]>(['users']);
            if (users) {
                localStorage.setItem('geds_users_cache', JSON.stringify(users));
            }
        },
    });
};

// User güncelleme mutation
export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (user: User) => {
            await setDoc(doc(db, 'users', user.id), user);
            return user;
        },
        onMutate: async (updatedUser) => {
            await queryClient.cancelQueries({ queryKey: ['users'] });
            const previousUsers = queryClient.getQueryData<User[]>(['users']);

            queryClient.setQueryData<User[]>(['users'], (old) =>
                old ? old.map(u => u.id === updatedUser.id ? updatedUser : u) : [updatedUser]
            );

            return { previousUsers };
        },
        onError: (err, updatedUser, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(['users'], context.previousUsers);
            }
        },
        onSuccess: () => {
            const users = queryClient.getQueryData<User[]>(['users']);
            if (users) {
                localStorage.setItem('geds_users_cache', JSON.stringify(users));
            }
        },
    });
};

// User silme mutation
export const useDeleteUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: string) => {
            await deleteDoc(doc(db, 'users', userId));
            return userId;
        },
        onMutate: async (userId) => {
            await queryClient.cancelQueries({ queryKey: ['users'] });
            const previousUsers = queryClient.getQueryData<User[]>(['users']);

            queryClient.setQueryData<User[]>(['users'], (old) =>
                old ? old.filter(u => u.id !== userId) : []
            );

            return { previousUsers };
        },
        onError: (err, userId, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(['users'], context.previousUsers);
            }
        },
        onSuccess: () => {
            const users = queryClient.getQueryData<User[]>(['users']);
            if (users) {
                localStorage.setItem('geds_users_cache', JSON.stringify(users));
            }
        },
    });
};

// ============================================
// PASSIVE EVENTS QUERY
// ============================================

// Passive events'i getir (2 saat cache)
export const usePassiveEvents = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['events', 'passive'],
        queryFn: async () => {
            console.log('🔄 Passive events sorgusu çalışıyor (Son 35)...');

            try {
                // 1. Yol: Optimize Sorgu (limitToLast)
                const q = query(
                    collection(db, 'events'),
                    where('status', '==', 'PASSIVE'),
                    orderBy('startDate', 'asc'), // Eski index ile uyumlu olması için ASC
                    limitToLast(35) // Sondan 35 tanesini al (En yeniler)
                );

                // Öncelik: Sunucudan en güncel veriyi al (Cache bypass)
                const snapshot = await getDocsFromServer(q);
                const events: Event[] = snapshot.docs.map(doc => doc.data() as Event);

                // LocalStorage'a kaydet
                if (events.length > 0) {
                    localStorage.setItem('geds_passive_events_cache_v3', JSON.stringify(events));
                }
                return events;

            } catch (error) {
                console.warn("⚠️ Sunucudan optimize veri çekilemedi (index sorunu olabilir), tüm veri çekiliyor...", error);

                // Fallback: Index sorunu varsa TÜM pasif verileri çekip client-side filtrele
                try {
                    const fallbackQ = query(
                        collection(db, 'events'),
                        where('status', '==', 'PASSIVE'),
                        orderBy('startDate', 'asc') // Eski çalışan sorgu
                    );

                    const snapshot = await getDocsFromServer(fallbackQ);
                    const allEvents: Event[] = snapshot.docs.map(doc => doc.data() as Event);

                    // Client-side slice: Son 35 tanesini al
                    const events = allEvents.slice(-35);

                    // LocalStorage'a kaydet
                    if (events.length > 0) {
                        localStorage.setItem('geds_passive_events_cache_v3', JSON.stringify(events));
                    }
                    return events;

                } catch (fallbackError) {
                    console.error("❌ Fallback de başarısız:", fallbackError);

                    // Son çare: LocalStorage (v3 yoksa v2, yoksa v1 dene)
                    const localCache = localStorage.getItem('geds_passive_events_cache_v3') ||
                        localStorage.getItem('geds_passive_events_cache_v2') ||
                        localStorage.getItem('geds_passive_events_cache');

                    if (localCache) {
                        try {
                            return JSON.parse(localCache);
                        } catch (e) { }
                    }

                    throw fallbackError;
                }
            }
        },
        staleTime: 2 * 60 * 60 * 1000, // 2 saat - pasif etkinlikler nadiren değişir
        gcTime: 4 * 60 * 60 * 1000, // 4 saat cache'de tut
        enabled, // Sadece gerektiğinde çalıştır
        initialData: () => {
            const cached = localStorage.getItem('geds_passive_events_cache_v3');
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (e) {
                    return undefined;
                }
            }
            return undefined;
        },
    });
};
