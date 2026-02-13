/**
 * Bu script, belirli etkinliklerin durumunu kontrol eder ve gerekirse PASSIVE yapar.
 * 
 * KULLANIM:
 * node check-event-status.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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

async function checkEventStatus() {
    console.log(`🔍 Etkinlik durumları kontrol ediliyor...\n`);

    // Tüm events'leri çek
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Aranacak etkinlikler (kısmi eşleşme)
    const searchTerms = [
        "Esenler Erokspor",
        "Fenerbahçe Opet"
    ];

    console.log(`📋 Toplam ${events.length} etkinlik bulundu.\n`);
    console.log(`🔎 Aranan etkinlikler:`);
    searchTerms.forEach((term, i) => {
        console.log(`   ${i + 1}. "${term}"`);
    });
    console.log();

    // Eşleşen etkinlikleri bul
    const matchedEvents = events.filter(event =>
        searchTerms.some(term => event.name.includes(term))
    );

    if (matchedEvents.length === 0) {
        console.log(`❌ Hiç eşleşen etkinlik bulunamadı!`);
        console.log(`\n📋 13.02.2026 tarihli tüm etkinlikler:`);
        events
            .filter(e => e.name.includes('13.02.2026'))
            .forEach(e => {
                console.log(`   - ${e.name} (${e.status})`);
            });
        process.exit(1);
    }

    console.log(`✅ ${matchedEvents.length} eşleşen etkinlik bulundu:\n`);

    const toUpdate = [];

    for (const event of matchedEvents) {
        console.log(`📋 ${event.name}`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Durum: ${event.status}`);
        console.log(`   Başlangıç: ${event.startDate}`);
        console.log(`   Bitiş: ${event.endDate}`);
        console.log(`   Hedef: ${event.targetCount}`);
        console.log(`   Mevcut: ${event.currentCount || 0}`);

        if (event.status !== 'PASSIVE') {
            console.log(`   ⚠️  Durum PASSIVE değil! Güncellenecek.`);
            toUpdate.push(event);
        } else {
            console.log(`   ✅ Zaten PASSIVE`);
        }
        console.log();
    }

    if (toUpdate.length === 0) {
        console.log(`✅ Tüm etkinlikler zaten PASSIVE durumunda!`);
        process.exit(0);
    }

    console.log(`\n🔄 ${toUpdate.length} etkinlik PASSIVE yapılacak:`);
    toUpdate.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.name} (${e.status} → PASSIVE)`);
    });

    console.log(`\n⚠️  ONAY GEREKLİ: Bu etkinlikler PASSIVE yapılacak!`);
    console.log(`   Devam etmek için 5 saniye bekleniyor...`);

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`\n🔄 Güncelleme başlıyor...`);

    for (const event of toUpdate) {
        await updateDoc(doc(db, 'events', event.id), {
            status: 'PASSIVE'
        });
        console.log(`   ✅ ${event.name} → PASSIVE`);
    }

    console.log(`\n🎉 İşlem tamamlandı!`);
    console.log(`   ${toUpdate.length} etkinlik PASSIVE yapıldı.`);

    process.exit(0);
}

checkEventStatus().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
