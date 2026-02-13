/**
 * Bu script, şirket bazlı sayaçları düzeltir ve fazla okutmaları temizler.
 * 
 * KULLANIM:
 * node fix-company-counts.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
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

async function fixCompanyCounts() {
    console.log('🔧 Şirket bazlı sayaç düzeltme başlıyor...\n');

    // Tüm events'leri çek
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Tüm scanned_entries'leri çek
    const scannedSnapshot = await getDocs(collection(db, 'scanned_entries'));
    const allScans = scannedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📊 Toplam ${events.length} etkinlik ve ${allScans.length} okutma bulundu.\n`);

    // Her event için şirket bazlı sayıları düzelt
    for (const event of events) {
        if (!event.companies || event.companies.length === 0) {
            console.log(`⏭️  ${event.name}: Şirket bilgisi yok, atlanıyor.`);
            continue;
        }

        console.log(`\n📋 ${event.name}`);
        console.log(`   Şirketler: ${event.companies.map(c => c.name).join(', ')}`);

        // Bu event'e ait tüm okutmaları al
        const eventScans = allScans.filter(s => s.eventId === event.id);
        console.log(`   Toplam okutma: ${eventScans.length}`);

        // Şirket bazlı gerçek sayıları hesapla
        const companyCounts = {};
        const companyUserCounts = {};
        const userCounts = {};

        eventScans.forEach(scan => {
            const user = scan.recordedBy || 'Bilinmiyor';
            const company = scan.companyName;

            // User counts
            userCounts[user] = (userCounts[user] || 0) + 1;

            if (company) {
                const safeCompany = company.replace(/\./g, '_');
                const safeUser = user.replace(/\./g, '_');

                // Company counts
                companyCounts[safeCompany] = (companyCounts[safeCompany] || 0) + 1;

                // Company-User counts
                const key = `${safeCompany}__${safeUser}`;
                companyUserCounts[key] = (companyUserCounts[key] || 0) + 1;
            }
        });

        // Her şirket için kontrol et
        let hasIssue = false;
        for (const company of event.companies) {
            const safeCompany = company.name.replace(/\./g, '_');
            const actualCount = companyCounts[safeCompany] || 0;
            const targetCount = company.count;

            if (actualCount !== targetCount) {
                console.log(`   ⚠️  ${company.name}:`);
                console.log(`      Hedef: ${targetCount}, Gerçek: ${actualCount}`);
                hasIssue = true;

                if (actualCount > targetCount) {
                    console.log(`      ❌ FAZLA OKUTMA TESPIT EDİLDİ! ${actualCount - targetCount} fazla kayıt var.`);
                }
            } else {
                console.log(`   ✅ ${company.name}: ${actualCount}/${targetCount} (doğru)`);
            }
        }

        // Firestore'u güncelle
        if (hasIssue || event.currentCount !== eventScans.length) {
            console.log(`\n   🔄 Firestore güncelleniyor...`);

            const updates = {
                currentCount: eventScans.length,
                companyCounts: companyCounts,
                companyUserCounts: companyUserCounts,
                userCounts: userCounts
            };

            await updateDoc(doc(db, 'events', event.id), updates);
            console.log(`   ✅ Güncellendi!`);
        }
    }

    console.log('\n\n🎉 İşlem tamamlandı!');
    console.log('\n⚠️  NOT: Fazla okutmalar tespit edildi ise, manuel olarak silinmesi gerekebilir.');
    console.log('   Admin panelinden ilgili kayıtları kontrol edip silebilirsiniz.');
    process.exit(0);
}

fixCompanyCounts().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
