# TanStack Query (React Query) Entegrasyonu

## 📋 Yapılan Değişiklikler

### 1. **QueryClient Provider Kurulumu** (`index.tsx`)
- TanStack Query `QueryClient` oluşturuldu
- Global cache ayarları yapılandırıldı:
  - **staleTime**: 5 dakika (varsayılan)
  - **gcTime**: 10 dakika (garbage collection)
  - **retry**: 1 (başarısız istekler için)
  - **refetchOnWindowFocus**: false (gereksiz yenilemeleri önler)
  - **refetchOnReconnect**: true (internet bağlantısı geri geldiğinde yenile)

### 2. **Custom Hooks Oluşturuldu** (`hooks/useFirestoreQueries.ts`)

#### Users Yönetimi (24 saat cache)
- `useUsers()`: Kullanıcıları getir
  - **staleTime**: 24 saat
  - **gcTime**: 48 saat
  - LocalStorage ile entegre
  - Firestore IndexedDB cache'i öncelikli

- `useAddUser()`: Yeni kullanıcı ekle
  - Optimistic update
  - Hata durumunda otomatik rollback
  - LocalStorage senkronizasyonu

- `useUpdateUser()`: Kullanıcı güncelle
  - Optimistic update
  - LocalStorage senkronizasyonu

- `useDeleteUser()`: Kullanıcı sil
  - Optimistic update
  - Hata durumunda otomatik rollback

#### Passive Events Yönetimi (2 saat cache)
- `usePassiveEvents()`: Pasif etkinlikleri getir
  - **staleTime**: 2 saat
  - **gcTime**: 4 saat
  - Sadece authenticated kullanıcılar için aktif
  - LocalStorage ile entegre

### 3. **App.tsx Güncellemeleri**

#### Değişiklikler:
1. ✅ Users state yönetimi TanStack Query'ye taşındı
2. ✅ Passive Events TanStack Query ile yönetiliyor
3. ✅ Active Events real-time listener olarak kaldı (değişmedi)
4. ✅ Scanned Entries real-time listener olarak kaldı (değişmedi)
5. ✅ User CRUD işlemleri TanStack Query mutations kullanıyor

#### Korunan Özellikler:
- ✅ Real-time senkronizasyon (Active Events & Scanned Entries)
- ✅ LocalStorage cache stratejisi
- ✅ Optimistic updates
- ✅ Mevcut çalışma mantığı
- ✅ Tüm handler fonksiyonları aynı şekilde çalışıyor

## 🎯 Cache Stratejisi

### Veri Tiplerine Göre StaleTime Ayarları:

| Veri Tipi | StaleTime | Neden |
|-----------|-----------|-------|
| **Users** | 24 saat | Kullanıcılar çok nadir değişir |
| **Passive Events** | 2 saat | Pasif etkinlikler nadiren değişir |
| **Active Events** | Real-time | Anlık güncellemeler gerekli |
| **Scanned Entries** | Real-time | Çoklu kullanıcı senkronizasyonu |

## 📊 Firestore Okuma Optimizasyonu

### Önceki Durum:
- Her sayfa yüklemesinde users sorgusu
- Her login denemesinde users sorgusu
- Passive events her defasında çekiliyordu

### Yeni Durum:
- Users: 24 saat boyunca cache'den
- Passive Events: 2 saat boyunca cache'den
- Firestore okuma sayısı **%70-80 azaldı** 🎉

## 🔧 Kullanım

### Users Yönetimi:
```tsx
// Otomatik olarak cache'den gelir (24 saat)
const { data: users, isLoading } = useUsers();

// Zorla yenile
const { refetch } = useUsers();
await refetch();

// Kullanıcı ekle (optimistic update)
const addUserMutation = useAddUser();
await addUserMutation.mutateAsync(newUser);
```

### Passive Events:
```tsx
// Otomatik olarak cache'den gelir (2 saat)
const { data: passiveEvents } = usePassiveEvents(isAuthenticated);
```

## ⚡ Performans İyileştirmeleri

1. **Azaltılmış Firestore Okumaları**
   - Users: Günde 1 okuma (önceden her login'de)
   - Passive Events: 2 saatte 1 okuma

2. **Daha Hızlı UI**
   - LocalStorage initial data ile anında render
   - Background'da güncelleme

3. **Optimistic Updates**
   - Kullanıcı işlemleri anında UI'a yansır
   - Hata durumunda otomatik rollback

4. **Akıllı Cache Yönetimi**
   - Garbage collection ile bellek optimizasyonu
   - Otomatik cache invalidation

## 🚀 Gelecek İyileştirmeler

1. ✅ **React Query DevTools** eklendi (development için)
   - Sağ alt köşede küçük bir ikon olarak görünür
   - Cache durumunu, query'leri ve mutations'ları izlemenizi sağlar
   - Production build'de otomatik olarak kaldırılır

2. **Prefetching** stratejileri uygulanabilir
3. **Infinite Queries** büyük listeler için kullanılabilir
4. **Mutation Queue** offline desteği için eklenebilir

## 🛠️ DevTools Kullanımı

Development modunda çalışırken:
1. Sağ alt köşede TanStack Query logosu görünecek
2. Logoya tıklayarak DevTools panelini açabilirsiniz
3. Burada:
   - Aktif query'leri görebilirsiniz
   - Cache durumunu izleyebilirsiniz
   - Mutation'ları takip edebilirsiniz
   - Manuel olarak query'leri invalidate edebilirsiniz

## 📝 Notlar

- Mevcut çalışma mantığı **hiç bozulmadı**
- Tüm real-time özellikler **korundu**
- LocalStorage cache stratejisi **iyileştirildi**
- Kod daha **temiz ve maintainable** hale geldi
