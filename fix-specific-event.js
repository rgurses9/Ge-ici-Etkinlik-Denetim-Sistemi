/**
 * Bu script, belirli bir etkinliğin şirket sayaçlarını kontrol edip düzeltir.
 * 
 * KULLANIM:
 * node fix-specific-event.js "13.02.2026 Galatasaray A.Ş. – İkas Eyüpspor Trendyol Süper Ligi Futbol Müsabakası"
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
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

async function fixSpecificEvent() {
    const eventName = process.argv[2] || "13.02.2026 Galatasaray A.Ş. – İkas Eyüpspor Trendyol Süper Ligi Futbol Müsabakası";

    console.log(`🔧 "${eventName}" etkinliği düzeltiliyor...\n`);

    // Event'i bul
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const event = eventsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(e => e.name === eventName);

    if (!event) {
        console.error(`❌ "${eventName}" etkinliği bulunamadı!`);
        process.exit(1);
    }

    console.log(`✅ Etkinlik bulundu: ${event.id}`);
    console.log(`   Durum: ${event.status}`);
    console.log(`   Toplam hedef: ${event.targetCount}`);
    console.log(`   Mevcut sayaç: ${event.currentCount}`);

    if (event.companies && event.companies.length > 0) {
        console.log(`\n📋 Şirketler:`);
        event.companies.forEach(c => {
            console.log(`   - ${c.name}: Hedef ${c.count}`);
        });
    }

    // Bu event'e ait tüm scanned_entries'leri çek
    const scannedSnapshot = await getDocs(collection(db, 'scanned_entries'));
    const allScans = scannedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const eventScans = allScans.filter(s => s.eventId === event.id);

    console.log(`\n📊 Firestore'da ${eventScans.length} okutma bulundu.`);

    // Şirket bazlı gerçek sayıları hesapla
    const companyCounts = {};
    const companyUserCounts = {};
    const userCounts = {};
    const companyDetails = {};

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

            // Details for reporting
            if (!companyDetails[company]) {
                companyDetails[company] = [];
            }
            companyDetails[company].push(scan);
        }
    });

    console.log(`\n📊 Gerçek Şirket Sayıları:`);
    Object.entries(companyDetails).forEach(([company, scans]) => {
        const target = event.companies?.find(c => c.name === company)?.count || 0;
        console.log(`   ${company}: ${scans.length}/${target}`);

        if (scans.length > target) {
            console.log(`      ⚠️  FAZLA OKUTMA! ${scans.length - target} fazla kayıt var.`);
            console.log(`      İlk 5 fazla kayıt:`);
            scans.slice(target, target + 5).forEach((s, i) => {
                console.log(`         ${i + 1}. TC: ${s.citizen?.tc}, Ad: ${s.citizen?.name} ${s.citizen?.surname}, Kaydeden: ${s.recordedBy}`);
            });
        }
    });

    // Firestore'daki mevcut companyCounts ile karşılaştır
    console.log(`\n🔍 Firestore'daki Mevcut Değerler:`);
    if (event.companyCounts) {
        Object.entries(event.companyCounts).forEach(([company, count]) => {
            const realCompany = company.replace(/_/g, '.');
            const realCount = companyCounts[company] || 0;
            const match = realCount === count ? '✅' : '❌';
            console.log(`   ${match} ${realCompany}: Firestore=${count}, Gerçek=${realCount}`);
        });
    }

    // Güncelleme yap
    console.log(`\n🔄 Firestore güncelleniyor...`);
    const updates = {
        currentCount: eventScans.length,
        companyCounts: companyCounts,
        companyUserCounts: companyUserCounts,
        userCounts: userCounts
    };

    await updateDoc(doc(db, 'events', event.id), updates);
    console.log(`✅ Güncelleme tamamlandı!`);

    console.log(`\n📋 Yeni Değerler:`);
    console.log(`   currentCount: ${eventScans.length}`);
    console.log(`   companyCounts:`, companyCounts);

    console.log('\n🎉 İşlem tamamlandı!');
    process.exit(0);
}

fixSpecificEvent().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
