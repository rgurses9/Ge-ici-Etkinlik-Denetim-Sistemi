/**
 * Bu script, Ekol Grup'taki fazla kayıtları (hedef: 155, mevcut: 298) temizler.
 * SON EKLENEN 143 kaydı siler (timestamp'e göre).
 * 
 * KULLANIM:
 * node delete-excess-ekol.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { readFileSync } from 'fs';

// .env.local'dan config oku
const envContent = readFileSync('.env.local', 'utf-8');
const config = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        config[key.replace('VITE_', '')] = value.trim();
    }
});

const firebaseConfig = {
    apiKey: config.FIREBASE_API_KEY,
    authDomain: config.FIREBASE_AUTH_DOMAIN,
    projectId: config.FIREBASE_PROJECT_ID,
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID,
    appId: config.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteExcessEkolRecords() {
    const eventName = "13.02.2026 Galatasaray A.Ş. – İkas Eyüpspor Trendyol Süper Ligi Futbol Müsabakası";
    const companyName = "Ekol Grup Güvenlik Koruma ve Eğitim Hizmetleri A.Ş.";
    const targetCount = 155;

    console.log(`🔧 Ekol Grup fazla kayıtları siliniyor...\n`);

    // Event'i bul
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const event = eventsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(e => e.name === eventName);

    if (!event) {
        console.error(`❌ Etkinlik bulunamadı!`);
        process.exit(1);
    }

    console.log(`✅ Etkinlik bulundu: ${event.id}`);

    // Ekol Grup kayıtlarını çek
    const scannedSnapshot = await getDocs(collection(db, 'scanned_entries'));
    const allScans = scannedSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    const ekolScans = allScans.filter(s =>
        s.eventId === event.id &&
        s.companyName === companyName
    );

    console.log(`📊 Ekol Grup'ta ${ekolScans.length} okutma bulundu.`);
    console.log(`   Hedef: ${targetCount}`);
    console.log(`   Fazla: ${ekolScans.length - targetCount}`);

    if (ekolScans.length <= targetCount) {
        console.log(`\n✅ Fazla kayıt yok, işlem gerekmiyor.`);
        process.exit(0);
    }

    // Timestamp'e göre sırala (en eski önce)
    // serverTimestamp varsa onu kullan, yoksa id'den çıkar
    ekolScans.sort((a, b) => {
        const timeA = a.serverTimestamp || parseInt(a.id);
        const timeB = b.serverTimestamp || parseInt(b.id);
        return timeA - timeB;
    });

    // İlk 155'i tut, geri kalanını sil
    const toKeep = ekolScans.slice(0, targetCount);
    const toDelete = ekolScans.slice(targetCount);

    console.log(`\n🗑️  ${toDelete.length} kayıt silinecek (SON EKLENEN kayıtlar):`);
    toDelete.slice(0, 10).forEach((s, i) => {
        console.log(`   ${i + 1}. TC: ${s.citizen?.tc}, Ad: ${s.citizen?.name} ${s.citizen?.surname}, Kaydeden: ${s.recordedBy}`);
    });
    if (toDelete.length > 10) {
        console.log(`   ... ve ${toDelete.length - 10} kayıt daha`);
    }

    console.log(`\n⚠️  ONAY GEREKLİ: Bu ${toDelete.length} kayıt silinecek!`);
    console.log(`   Devam etmek için 10 saniye bekleniyor...`);

    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`\n🔄 Silme işlemi başlıyor...`);

    // User ve company sayaçlarını hesapla
    const userDecrements = {};
    const companyUserDecrements = {};

    toDelete.forEach(scan => {
        const user = scan.recordedBy || 'Bilinmiyor';
        userDecrements[user] = (userDecrements[user] || 0) + 1;

        const safeCompany = companyName.replace(/\./g, '_');
        const safeUser = user.replace(/\./g, '_');
        const key = `${safeCompany}__${safeUser}`;
        companyUserDecrements[key] = (companyUserDecrements[key] || 0) + 1;
    });

    // Kayıtları sil
    let deletedCount = 0;
    for (const scan of toDelete) {
        await deleteDoc(doc(db, 'scanned_entries', scan.id));
        deletedCount++;
        if (deletedCount % 10 === 0) {
            console.log(`   ${deletedCount}/${toDelete.length} silindi...`);
        }
    }

    console.log(`✅ ${deletedCount} kayıt silindi.`);

    // Event sayaçlarını güncelle
    console.log(`\n🔄 Event sayaçları güncelleniyor...`);

    const updates = {
        currentCount: increment(-toDelete.length),
        [`companyCounts.Ekol Grup Güvenlik Koruma ve Eğitim Hizmetleri A_Ş_`]: increment(-toDelete.length)
    };

    // User counts
    Object.entries(userDecrements).forEach(([user, count]) => {
        updates[`userCounts.${user}`] = increment(-count);
    });

    // Company-User counts
    Object.entries(companyUserDecrements).forEach(([key, count]) => {
        updates[`companyUserCounts.${key}`] = increment(-count);
    });

    await updateDoc(doc(db, 'events', event.id), updates);

    console.log(`✅ Sayaçlar güncellendi!`);
    console.log(`\n🎉 İşlem tamamlandı!`);
    console.log(`   Ekol Grup: ${targetCount}/${targetCount} ✅`);

    process.exit(0);
}

deleteExcessEkolRecords().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
