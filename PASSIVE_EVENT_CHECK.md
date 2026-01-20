# PASSIVE Etkinlik Çakışma Kontrolü Eklendi

## Tarih: 20 Ocak 2026

## Sorun
TC kimlik kartı okutulduğunda, **PASSIVE (geçmiş/tamamlanmış) etkinlikler**deki kayıtlar kontrol edilmiyordu. 

### Detaylı Açıklama
Önceki düzeltmede sadece **saat çakışmasını** düzelttik ama **yalnızca ACTIVE etkinlikler** için kontrol ediyorduk. 

PASSIVE etkinlikler **lazy loading** ile yüklendiği için (performans nedeniyle), `allScannedEntries` objesinde her zaman bulunmuyorlar. Bu yüzden PASSIVE bir etkinlikte çalışmış olan bir kişi, aynı gün aynı saatlerde başka bir etkinliğe de eklenebiliyordu - **bu YANLIŞTI**.

### Örnek Senaryo (SORUN):
```
PASSIVE Etkinlik: 21.01.2026 10:00-12:00 (tamamlanmış)
- TC 12345678901: ✓ Katıldı

ACTIVE Etkinlik: 21.01.2026 10:00-12:00 (şu an açık)
- TC 12345678901: ✓ KABUL EDİLDİ ❌ (YANLIŞTI! Aynı saatte başka yerde çalışmış)
```

## Çözüm: Yaklaşım 1 - Performanslı Firebase Query

### Nasıl Çalışıyor?

1. **TC okutulduğunda:**
   - Mevcut etkinliğin başlangıç ve bitiş saatleri alınır
   - PASSIVE events listesinde **çakışan saatlerdeki etkinlikler bulunur**
   - Sadece bu çakışan etkinlikler için Firebase sorgusu yapılır
   
2. **Firebase Query:**
   ```typescript
   query(
     collection(db, 'scanned_entries'),
     where('eventId', 'in', [çakışan_passive_event_ids]),
     where('citizen.tc', '==', trimmedTC)
   )
   ```

3. **Sonuç:**
   - Eğer TC bu PASSIVE etkinliklerde bulunursa → **HATA VER**
   - Bulunamazsa → **Kayda devam et**

### Avantajlar:
- ✅ **Performanslı**: Sadece çakışan saatlerdeki PASSIVE etkinlikler sorgulanıyor
- ✅ **Doğru**: Tüm geçmiş kayıtlar kontrol ediliyor
- ✅ **Ölçeklenebilir**: Firebase index kullanıyor, hızlı
- ✅ **İki yönlü**: Hem manuel okutma hem Excel yükleme çalışıyor

## Teknik Detaylar

### Değiştirilen Dosyalar

#### 1. **App.tsx** (Satır 1154)
```diff
  <AuditScreen
    event={activeEvent}
    allEvents={events}
+   passiveEvents={passiveEvents}
    currentUser={session.currentUser}
    ...
```

#### 2. **components/AuditScreen.tsx**

**a. Import'lar eklendi (Satır 5-6):**
```typescript
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
```

**b. Props interface güncellendi (Satır 177):**
```diff
interface AuditScreenProps {
  event: Event;
  allEvents: Event[]; // For cross checking (ACTIVE events)
+ passiveEvents: Event[]; // For cross checking (PASSIVE events - lazy loaded)
  ...
}
```

**c. Manuel okutma kontrolü (Satır 457-514):**
```typescript
// Check PASSIVE events with overlapping time
if (!conflictError) {
  const currentStart = new Date(event.startDate).getTime();
  const currentEnd = new Date(event.endDate).getTime();

  // Find PASSIVE events with overlapping time
  const overlappingPassiveEvents = passiveEvents.filter(passiveEvent => {
    const passiveStart = new Date(passiveEvent.startDate).getTime();
    const passiveEnd = new Date(passiveEvent.endDate).getTime();
    return (currentStart < passiveEnd) && (currentEnd > passiveStart);
  });

  if (overlappingPassiveEvents.length > 0) {
    // Query Firebase for this TC in overlapping passive events
    try {
      const passiveEventIds = overlappingPassiveEvents.map(e => e.id);
      
      // Firebase 'in' query has limit of 10, so batch if needed
      const BATCH_SIZE = 10;
      for (let i = 0; i < passiveEventIds.length; i += BATCH_SIZE) {
        const batchIds = passiveEventIds.slice(i, i + BATCH_SIZE);
        
        const q = query(
          collection(db, 'scanned_entries'),
          where('eventId', 'in', batchIds),
          where('citizen.tc', '==', trimmedTC)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          // Found a conflict!
          const conflictEntry = snapshot.docs[0].data() as ScanEntry;
          const conflictEvent = passiveEvents.find(e => e.id === conflictEntry.eventId);
          
          if (conflictEvent) {
            const startTime = new Date(conflictEvent.startDate).toLocaleString('tr-TR', {...});
            const endTime = new Date(conflictEvent.endDate).toLocaleTimeString('tr-TR', {...});
            conflictError = `Bu kimlik ${conflictEvent.name} etkinliğinde ${startTime} - ${endTime} arasında çalıştı, bu saatte başka görev alamaz.`;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking PASSIVE events:', error);
      // Don't block the scan if Firebase query fails
    }
  }
}
```

**d. Excel toplu yükleme kontrolü (Satır 719-756):**
- Aynı mantık Excel yükleme için de eklendi
- `reader.onload` fonksiyonu `async` yapıldı (satır 601)

## Kullanıcı Deneyimi

### Önceki Davranış (YANLIŞ ❌):
```
PASSIVE: 21.01.2026 10:00-12:00
  TC 12345: ✓ Çalıştı

ACTIVE: 21.01.2026 10:00-12:00
  TC 12345: ✓ Kabul edildi (YANLIŞTI!)
```

### Yeni Davranış (DOĞRU ✓):
```
PASSIVE: 21.01.2026 10:00-12:00
  TC 12345: ✓ Çalıştı

ACTIVE: 21.01.2026 10:00-12:00
  TC 12345: ❌ HATA!
  "Bu kimlik 21.01.2026 10:00-12:00 - 12:00 arasında çalıştı, bu saatte başka görev alamaz."
```

## Performans

### Firebase Sorgu Sayısı:
- **En kötü durum**: Çakışan her 10 PASSIVE etkinlik için 1 sorgu
- **Ortalama**: Çoğu durumda 0-1 sorgu (çakışan etkinlik yoksa sorgu yapılmaz)
- **Optimizasyon**: Batch processing (10'luk gruplar)

### Index Gereksinimleri:
Firebase'de composite index gerekebilir:
```
Collection: scanned_entries
Fields: 
  - eventId (Ascending)
  - citizen.tc (Ascending)
```

## Test Senaryoları

### Senaryo 1: PASSIVE çakışma VAR
```
✓ PASSIVE: 21.01.2026 10:00-12:00 (TC 111 katıldı)
✗ ACTIVE:  21.01.2026 11:00-13:00 (TC 111 eklenmeye çalışıyor)
→ HATA: "Bu kimlik ... etkinliğinde çalıştı"
```

### Senaryo 2: PASSIVE çakışma YOK (farklı saatler)
```
✓ PASSIVE: 21.01.2026 10:00-12:00 (TC 222 katıldı)
✓ ACTIVE:  21.01.2026 14:00-16:00 (TC 222 eklenmeye çalışıyor)
→ BAŞARILI
```

### Senaryo 3: PASSIVE çakışma YOK (farklı gün)
```
✓ PASSIVE: 21.01.2026 10:00-12:00 (TC 333 katıldı)
✓ ACTIVE:  22.01.2026 10:00-12:00 (TC 333 eklenmeye çalışıyor)
→ BAŞARILI
```

### Senaryo 4: Excel toplu yükleme
```
PASSIVE: 21.01.2026 10:00-12:00 (TC 444, 555 katıldı)
ACTIVE:  21.01.2026 10:00-12:00 (Excel: TC 444, 666)
→ TC 444: HATA (çakışma)
→ TC 666: BAŞARILI
```

## Build Bilgileri
- ✅ Build başarılı (10.55s)
- ✅ Chunk boyutları: 862.85 KB (gzip: 215.98 KB)
- ✅ TypeScript hatasız
- ✅ PWA manifest güncellendi

## İlgili Dosyalar
- `/Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi/App.tsx`
- `/Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi/components/AuditScreen.tsx`

## Notlar
- Firebase console'da composite index oluşturmanız gerekebilir
- İlk kullanımda Firebase otomatik olarak index oluşturma linki verir
- Query fail olursa scan engellenmiyor (try-catch ile korunmuş)
