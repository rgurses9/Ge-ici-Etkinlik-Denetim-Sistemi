/**
 * Bu script, Ekol Grup'taki mükerrer kayıtları (aynı TC 2 kez okutulmuş) temizler.
 * Her TC için SADECE İLK okutmayı tutar, 2. ve sonraki okutmaları siler.
 * 
 * KULLANIM:
 * node delete-duplicate-ekol.js
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

async function deleteDuplicateEkolRecords() {
    const eventName = "13.02.2026 Galatasaray A.Ş. – İkas Eyüpspor Trendyol Süper Ligi Futbol Müsabakası";
    const companyName = "Ekol Grup Güvenlik Koruma ve Eğitim Hizmetleri A.Ş.";

    console.log(`🔧 Ekol Grup mükerrer kayıtları temizleniyor...\n`);

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

    // TC'ye göre grupla
    const tcGroups = {};
    ekolScans.forEach(scan => {
        const tc = scan.citizen?.tc;
        if (!tc) return;

        if (!tcGroups[tc]) {
            tcGroups[tc] = [];
        }
        tcGroups[tc].push(scan);
    });

    console.log(`📋 ${Object.keys(tcGroups).length} benzersiz TC bulundu.`);

    // Mükerrer kayıtları bul
    const duplicates = [];
    const uniqueTCs = Object.keys(tcGroups).length;
    let duplicateCount = 0;

    Object.entries(tcGroups).forEach(([tc, scans]) => {
        if (scans.length > 1) {
            duplicateCount++;
            // Timestamp'e göre sırala (en eski önce)
            scans.sort((a, b) => {
                const timeA = a.serverTimestamp || parseInt(a.id);
                const timeB = b.serverTimestamp || parseInt(b.id);
                return timeA - timeB;
            });

            // İlk kaydı tut, geri kalanını sil
            const toDelete = scans.slice(1);
            duplicates.push(...toDelete);

            console.log(`   🔍 TC: ${tc} - ${scans.length} kez okutulmuş (${toDelete.length} mükerrer)`);
            console.log(`      İLK: ${scans[0].citizen?.name} ${scans[0].citizen?.surname} - ${scans[0].timestamp} (KORUNACAK)`);
            toDelete.forEach((s, i) => {
                console.log(`      ${i + 2}. : ${s.citizen?.name} ${s.citizen?.surname} - ${s.timestamp} (SİLİNECEK)`);
            });
        }
    });

    console.log(`\n📊 Özet:`);
    console.log(`   Toplam okutma: ${ekolScans.length}`);
    console.log(`   Benzersiz TC: ${uniqueTCs}`);
    console.log(`   Mükerrer TC sayısı: ${duplicateCount}`);
    console.log(`   Silinecek kayıt: ${duplicates.length}`);
    console.log(`   Kalacak kayıt: ${uniqueTCs}`);

    if (duplicates.length === 0) {
        console.log(`\n✅ Mükerrer kayıt yok, işlem gerekmiyor.`);
        process.exit(0);
    }

    console.log(`\n🗑️  ${duplicates.length} mükerrer kayıt silinecek:`);
    duplicates.slice(0, 10).forEach((s, i) => {
        console.log(`   ${i + 1}. TC: ${s.citizen?.tc}, Ad: ${s.citizen?.name} ${s.citizen?.surname}, Kaydeden: ${s.recordedBy}, Saat: ${s.timestamp}`);
    });
    if (duplicates.length > 10) {
        console.log(`   ... ve ${duplicates.length - 10} kayıt daha`);
    }

    console.log(`\n⚠️  ONAY GEREKLİ: Bu ${duplicates.length} MÜKERRER kayıt silinecek!`);
    console.log(`   Devam etmek için 10 saniye bekleniyor...`);

    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`\n🔄 Silme işlemi başlıyor...`);

    // User ve company sayaçlarını hesapla
    const userDecrements = {};
    const companyUserDecrements = {};

    duplicates.forEach(scan => {
        const user = scan.recordedBy || 'Bilinmiyor';
        userDecrements[user] = (userDecrements[user] || 0) + 1;

        const safeCompany = companyName.replace(/\./g, '_');
        const safeUser = user.replace(/\./g, '_');
        const key = `${safeCompany}__${safeUser}`;
        companyUserDecrements[key] = (companyUserDecrements[key] || 0) + 1;
    });

    // Kayıtları sil
    let deletedCount = 0;
    for (const scan of duplicates) {
        await deleteDoc(doc(db, 'scanned_entries', scan.id));
        deletedCount++;
        if (deletedCount % 10 === 0) {
            console.log(`   ${deletedCount}/${duplicates.length} silindi...`);
        }
    }

    console.log(`✅ ${deletedCount} mükerrer kayıt silindi.`);

    // Event sayaçlarını güncelle
    console.log(`\n🔄 Event sayaçları güncelleniyor...`);

    const updates = {
        currentCount: increment(-duplicates.length),
        [`companyCounts.Ekol Grup Güvenlik Koruma ve Eğitim Hizmetleri A_Ş_`]: increment(-duplicates.length)
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
    console.log(`   Ekol Grup: ${uniqueTCs} benzersiz kişi (mükerrerler temizlendi) ✅`);

    process.exit(0);
}

deleteDuplicateEkolRecords().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
