# Firebase Okuma Optimizasyon Planı

## Mevcut Durum
- **Reads**: 1.1M (1.1 milyon okuma) ❌
- **Writes**: 4.1K (4,100 yazma) ✅
- **Deletes**: 319 ✅

## Sorunun Kaynağı

### 1. Real-time Listeners (En Büyük Sorun)
Her kullanıcı login olduğunda:
- `events` collection'ı için real-time listener (tüm ACTIVE events)
- `scanned_entries` collection'ı için real-time listener (aktif event + overlapping events)
- Her snapshot değişikliğinde TÜM dökümanlar okunuyor

**Örnek**: 10 kullanıcı, 1000 scan entry olan bir event'te:
- Her kullanıcı login: 1000 okuma
- Her yeni scan: 10 kullanıcı x 1 okuma = 10 okuma
- Toplam: 10,000+ okuma sadece bir günde!

### 2. Cache Stratejisi Yetersiz
- LocalStorage cache var ama real-time listener her zaman çalışıyor
- Cache'den okusa bile Firestore'a da bağlanıyor

## Çözüm Planı

### ✅ Zaten Yapılmış Optimizasyonlar
1. ✅ Passive events için real-time listener kaldırıldı (sadece manuel refresh)
2. ✅ Overlapping events için one-time read (real-time değil)
3. ✅ TanStack Query ile user data cache (24 saat)
4. ✅ LocalStorage cache (24 saat)
5. ✅ Duplicate prevention (optimistic update)

### 🔧 Yapılması Gerekenler

#### 1. Real-time Listener'ı Daha Akıllı Yap
```tsx
// Sadece AUDIT MODE'dayken listener aç
// Dashboard'dayken listener KAPALI
```

#### 2. Pagination Ekle
```tsx
// İlk 100 entry'yi göster, kaydır kaydır yükle
limit(100) // Şu an 1500
```

#### 3. Offline Persistence Aktif Et
```tsx
// Firebase SDK'nın built-in offline cache'ini kullan
enableIndexedDbPersistence(db)
```

#### 4. Admin Dashboard'da Lazy Loading
```tsx
// Passive events'leri sadece tıklandığında yükle
// Şu an tüm events cache'den yükleniyor
```

## Acil Eylem Planı

### Adım 1: Firebase Plan Yükselt (Geçici)
- Blaze planına geç (pay-as-you-go)
- Aylık $25-50 arası maliyet bekleniyor

### Adım 2: Listener Limit Ekle (Bugün)
```tsx
// Sadece son 100 scan'i real-time takip et
limit(100) // Şu an 1500
```

### Adım 3: Offline Persistence (Bu Hafta)
```tsx
// IndexedDB ile offline cache
enableIndexedDbPersistence(db)
```

### Adım 4: Pagination (Gelecek Hafta)
```tsx
// Infinite scroll ile lazy loading
```

## Maliyet Tahmini

### Şu Anki Kullanım (Ücretsiz Plan Aşıldı)
- 1.1M okuma / gün = ~33M okuma / ay
- Ücretsiz: 50K okuma / gün
- Aşım: 1.05M okuma / gün

### Blaze Plan Maliyeti
- İlk 50K okuma: Ücretsiz
- Sonraki 1M okuma: $0.06 / 100K = $0.60
- **Toplam**: ~$18-20 / ay (33M okuma için)

### Optimizasyon Sonrası (Hedef)
- Listener limit: 100 → %93 azalma
- Offline cache → %50 azalma
- **Hedef**: 100K okuma / gün → Ücretsiz plan içinde! 🎉

## Öncelik Sırası

1. 🔴 **ACİL**: Firebase Blaze planına geç (yoksa servis durabilir)
2. 🟡 **BUGÜN**: Listener limit'i 1500'den 100'e düşür
3. 🟢 **BU HAFTA**: Offline persistence aktif et
4. 🔵 **GELECEKTEKİ**: Pagination ekle
