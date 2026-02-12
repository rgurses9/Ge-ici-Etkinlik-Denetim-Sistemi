# Multi-User Sync Sorunu ve Çözümü

## Sorun
İki kullanıcı aynı etkinlikte kimlik okutunca birbirlerini görmüyor.

## Neden
Son optimizasyonda overlapping events **bir kez** cache'den yükleniyor ve güncellenmiyor.
Her yeni scan geldiğinde, onSnapshot callback'i çalışıyor AMA overlapping events'i tekrar getDocs ile alıyor (stale data).

## Çözüm
Tüm overlapping events için ayrı real-time listener'lar ekle:
- Active event: limit(2000)
- Overlapping events: limit(500) - conflict check için

## Kod Değişikliği Gerekli
App.tsx satır 374-427 arası tamamen değiştirilmeli.

Şu anki kod:
```typescript
const unsubscribe = onSnapshot(q, async (snapshot) => {
  const activeEntries = snapshot.docs.map(d => d.data() as ScanEntry);
  
  // Overlapping events'i getDocs ile alıyor (STALE!)
  for (let i = 0; i < overlappingEventIds.length; i += 10) {
    const oSnapshot = await getDocs(oq); // ← BU HER SCAN'DE ESKİ VERİ
    // ...
  }
});
```

Olması gereken:
```typescript
const unsubscribers = [];

for (const eventId of overlappingEventIds) {
  const scanLimit = eventId === activeEventId ? 2000 : 500;
  
  const q = query(
    collection(db, 'scanned_entries'),
    where('eventId', '==', eventId),
    orderBy('serverTimestamp', 'desc'),
    limit(scanLimit)
  );

  const unsub = onSnapshot(q, (snapshot) => {
    setScannedEntries(prev => ({
      ...prev,
      [eventId]: snapshot.docs.map(d => d.data() as ScanEntry)
    }));
  });

  unsubscribers.push(unsub);
}

return () => unsubscribers.forEach(u => u());
```

## Okuma Sayısı Etkisi
- Active event: Her scan'de 1 read (zaten vardı)
- Overlapping events (genelde 1-2 tane): Her scan'de 1-2 read
- TOPLAM: ~3-4 read per scan (kabul edilebilir)
- Multi-user sync: ✅ ÇALIŞACAK
