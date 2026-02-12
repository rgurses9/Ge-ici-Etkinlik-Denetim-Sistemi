/**
 * Bu script, Firestore'daki events koleksiyonundaki currentCount değerlerini
 * scanned_entries'e göre düzeltir.
 * 
 * KULLANIM:
 * node fix-event-counts.js
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

async function fixEventCounts() {
    console.log('🔧 Event count düzeltme başlıyor...\n');

    // Tüm events'leri çek
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Tüm scanned_entries'leri çek
    const scannedSnapshot = await getDocs(collection(db, 'scanned_entries'));
    const scans = scannedSnapshot.docs.map(doc => doc.data());

    // Her event için gerçek count hesapla
    for (const event of events) {
        const actualCount = scans.filter(s => s.eventId === event.id).length;
        const storedCount = event.currentCount || 0;

        if (actualCount !== storedCount) {
            console.log(`❌ TUTARSIZLIK: ${event.name}`);
            console.log(`   Firestore'da: ${storedCount}, Gerçek: ${actualCount}`);
            console.log(`   Düzeltiliyor...`);

            await updateDoc(doc(db, 'events', event.id), {
                currentCount: actualCount
            });

            console.log(`   ✅ Düzeltildi!\n`);
        } else {
            console.log(`✅ ${event.name}: ${actualCount} (doğru)`);
        }
    }

    console.log('\n🎉 İşlem tamamlandı!');
    process.exit(0);
}

fixEventCounts().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
