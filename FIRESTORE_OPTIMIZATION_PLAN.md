# Firestore Okuma/Yazma Optimizasyon Stratejisi

## 📊 Mevcut Durum Analizi

**Firestore Kullanımı:**
- Okuma: 12M (çok yüksek!)
- Yazma: 70K (yüksek)
- Silme: 338

## 🎯 Optimizasyon Hedefleri

1. **Okuma sayısını %80-90 azalt** (12M → 1-2M)
2. **Yazma sayısını %50 azalt** (70K → 35K)
3. **Çalışma mantığını koruyarak**

## 🔧 Uygulanacak Optimizasyonlar

### 1. Real-time Listener Limitleri Azaltma

**Mevcut:**
```typescript
const scanLimit = eventId === activeEventId ? 2000 : 500;
```

**Yeni:**
```typescript
const scanLimit = eventId === activeEventId ? 200 : 50;
```

**Etki:**
- Aktif event için 2000 → 200 (10x azalma)
- Overlapping events için 500 → 50 (10x azalma)
- Her listener update'inde okunan doküman sayısı %90 azalır

**Risk:** Çok büyük etkinliklerde (200+ kişi) tüm liste görünmeyebilir
**Çözüm:** Pagination eklenebilir veya limit 500'e çıkarılabilir

### 2. Snapshot Değişiklik Tipi Kontrolü

**Mevcut:**
```typescript
onSnapshot(q, (snapshot) => {
  // Tüm dokümanları her seferinde işle
  setScannedEntries(prev => ({
    ...prev,
    [eventId]: snapshot.docs.map(d => d.data() as ScanEntry)
  }));
});
```

**Yeni:**
```typescript
onSnapshot(q, (snapshot) => {
  // Sadece değişen dokümanları işle
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      // Sadece yeni eklenen
    } else if (change.type === 'modified') {
      // Sadece değişen
    } else if (change.type === 'removed') {
      // Sadece silinen
    }
  });
});
```

**Etki:**
- İlk yüklemeden sonra sadece değişiklikler işlenir
- Okuma sayısı %70-80 azalır

### 3. Debounced Event Updates

**Mevcut:**
```typescript
// Her scan'de hemen Firestore'a yaz
await updateDoc(doc(db, 'events', entry.eventId), updates);
```

**Yeni:**
```typescript
// Batch updates - 5 saniyede bir toplu güncelle
const pendingUpdates = new Map();
const flushUpdates = debounce(() => {
  // Toplu güncelleme
}, 5000);
```

**Etki:**
- Yazma sayısı %60-70 azalır
- Hızlı scan'lerde performans artar

### 4. Conditional Listeners (Sadece Gerektiğinde)

**Mevcut:**
```typescript
// Her zaman tüm overlapping events için listener
for (const eventId of overlappingEventIds) {
  // Listener kur
}
```

**Yeni:**
```typescript
// Sadece aktif event için real-time
// Overlapping events için cache-first
if (eventId === activeEventId) {
  // Real-time listener
} else {
  // Cache'den oku, sadece conflict check için
}
```

**Etki:**
- Overlapping events için listener sayısı %90 azalır
- Okuma sayısı büyük oranda düşer

### 5. Incremental Sync (Delta Updates)

**Mevcut:**
```typescript
// Her seferinde tüm listeyi çek
orderBy('serverTimestamp', 'desc')
```

**Yeni:**
```typescript
// Son sync zamanından sonraki değişiklikleri çek
where('serverTimestamp', '>', lastSyncTime)
```

**Etki:**
- İlk yüklemeden sonra sadece yeni değişiklikler
- Okuma sayısı %80-90 azalır

## 📈 Beklenen Sonuçlar

| Metrik | Şu An | Hedef | İyileştirme |
|--------|-------|-------|-------------|
| **Okuma** | 12M | 1.5M | %87.5 ↓ |
| **Yazma** | 70K | 30K | %57 ↓ |
| **Maliyet** | Yüksek | Düşük | %80 ↓ |

## ⚠️ Riskler ve Önlemler

### Risk 1: Büyük Etkinlikler
- **Sorun:** 200 kişilik limit küçük olabilir
- **Çözüm:** Limit'i 500'e çıkar veya pagination ekle

### Risk 2: Gecikme
- **Sorun:** Debounced updates gecikme yaratabilir
- **Çözüm:** Optimistic UI ile anında göster, arka planda yaz

### Risk 3: Conflict Detection
- **Sorun:** Overlapping events için cache kullanımı conflict'leri kaçırabilir
- **Çözüm:** Scan sırasında manuel conflict check yap

## 🚀 Uygulama Sırası

1. ✅ **Aşama 1:** Listener limitleri azalt (200/50)
2. ✅ **Aşama 2:** Snapshot değişiklik tipi kontrolü
3. ✅ **Aşama 3:** Conditional listeners (sadece aktif event)
4. ⏳ **Aşama 4:** Debounced updates (opsiyonel)
5. ⏳ **Aşama 5:** Incremental sync (gelecek)

## 📝 Notlar

- TanStack Query zaten users ve passive events için %70-80 azalttı
- Bu optimizasyonlar scanned_entries ve events için
- Real-time özellikler korunacak
- Kullanıcı deneyimi etkilenmeyecek
