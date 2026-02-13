/**
 * Bu script, "Şirketsiz" kayıtları siler.
 * Çoklu şirketli etkinliklerde şirket bilgisi olmayan kayıtlar hatalıdır.
 * 
 * KULLANIM:
 * node delete-no-company.js
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

async function deleteNoCompanyRecords() {
    const eventName = "13.02.2026 Galatasaray A.Ş. – İkas Eyüpspor Trendyol Süper Ligi Futbol Müsabakası";

    console.log(`🔧 Şirketsiz kayıtlar siliniyor...\n`);

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
    console.log(`   Toplam hedef: ${event.targetCount}`);
    console.log(`   Mevcut sayaç: ${event.currentCount}\n`);

    // Şirketsiz kayıtları çek
    const scannedSnapshot = await getDocs(collection(db, 'scanned_entries'));
    const allScans = scannedSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    const noCompanyScans = allScans.filter(s =>
        s.eventId === event.id &&
        (!s.companyName || s.companyName === '')
    );

    console.log(`📊 ${noCompanyScans.length} şirketsiz kayıt bulundu.\n`);

    if (noCompanyScans.length === 0) {
        console.log(`✅ Şirketsiz kayıt yok!`);
        process.exit(0);
    }

    console.log(`🗑️  Silinecek kayıtlar:`);
    noCompanyScans.slice(0, 20).forEach((s, i) => {
        console.log(`   ${i + 1}. TC: ${s.citizen?.tc}, Ad: ${s.citizen?.name} ${s.citizen?.surname}, Kaydeden: ${s.recordedBy}, Saat: ${s.timestamp}`);
    });
    if (noCompanyScans.length > 20) {
        console.log(`   ... ve ${noCompanyScans.length - 20} kayıt daha`);
    }

    console.log(`\n⚠️  ONAY GEREKLİ: Bu ${noCompanyScans.length} ŞİRKETSİZ kayıt silinecek!`);
    console.log(`   Bu kayıtlar çoklu şirketli etkinlikte şirket bilgisi olmadan eklenmiş.`);
    console.log(`   Devam etmek için 10 saniye bekleniyor...`);

    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`\n🔄 Silme işlemi başlıyor...`);

    // User sayaçlarını hesapla
    const userDecrements = {};

    noCompanyScans.forEach(scan => {
        const user = scan.recordedBy || 'Bilinmiyor';
        userDecrements[user] = (userDecrements[user] || 0) + 1;
    });

    // Kayıtları sil
    let deletedCount = 0;
    for (const scan of noCompanyScans) {
        await deleteDoc(doc(db, 'scanned_entries', scan.id));
        deletedCount++;
        if (deletedCount % 10 === 0) {
            console.log(`   ${deletedCount}/${noCompanyScans.length} silindi...`);
        }
    }

    console.log(`✅ ${deletedCount} şirketsiz kayıt silindi.`);

    // Event sayaçlarını güncelle
    console.log(`\n🔄 Event sayaçları güncelleniyor...`);

    const updates = {
        currentCount: increment(-noCompanyScans.length)
    };

    // User counts
    Object.entries(userDecrements).forEach(([user, count]) => {
        updates[`userCounts.${user}`] = increment(-count);
    });

    await updateDoc(doc(db, 'events', event.id), updates);

    console.log(`✅ Sayaçlar güncellendi!`);
    console.log(`\n🎉 İşlem tamamlandı!`);
    console.log(`   Yeni toplam: ${event.currentCount - noCompanyScans.length}/${event.targetCount}`);

    process.exit(0);
}

deleteNoCompanyRecords().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
