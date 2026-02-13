/**
 * Bu script, TÜM şirketlerdeki mükerrer kayıtları temizler.
 * Her TC için SADECE İLK okutmayı tutar, 2. ve sonraki okutmaları siler.
 * 
 * KULLANIM:
 * node delete-all-duplicates.js
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

async function deleteAllDuplicates() {
    const eventName = "13.02.2026 Galatasaray A.Ş. – İkas Eyüpspor Trendyol Süper Ligi Futbol Müsabakası";

    console.log(`🔧 TÜM şirketlerdeki mükerrer kayıtlar temizleniyor...\n`);

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

    // Tüm kayıtları çek
    const scannedSnapshot = await getDocs(collection(db, 'scanned_entries'));
    const allScans = scannedSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    const eventScans = allScans.filter(s => s.eventId === event.id);

    console.log(`📊 Toplam ${eventScans.length} okutma bulundu.\n`);

    // Şirket bazlı grupla
    const companyGroups = {};
    eventScans.forEach(scan => {
        const company = scan.companyName || 'Şirketsiz';
        if (!companyGroups[company]) {
            companyGroups[company] = [];
        }
        companyGroups[company].push(scan);
    });

    console.log(`📋 ${Object.keys(companyGroups).length} şirket bulundu:\n`);

    // Her şirket için mükerrer kontrolü
    const allDuplicates = [];
    const companyStats = {};

    for (const [companyName, scans] of Object.entries(companyGroups)) {
        console.log(`\n🏢 ${companyName}:`);
        console.log(`   Toplam okutma: ${scans.length}`);

        // TC'ye göre grupla
        const tcGroups = {};
        scans.forEach(scan => {
            const tc = scan.citizen?.tc;
            if (!tc) return;

            if (!tcGroups[tc]) {
                tcGroups[tc] = [];
            }
            tcGroups[tc].push(scan);
        });

        const uniqueTCs = Object.keys(tcGroups).length;
        console.log(`   Benzersiz TC: ${uniqueTCs}`);

        // Mükerrer kayıtları bul
        const companyDuplicates = [];
        let duplicateCount = 0;

        Object.entries(tcGroups).forEach(([tc, tcScans]) => {
            if (tcScans.length > 1) {
                duplicateCount++;
                // Timestamp'e göre sırala (en eski önce)
                tcScans.sort((a, b) => {
                    const timeA = a.serverTimestamp || parseInt(a.id);
                    const timeB = b.serverTimestamp || parseInt(b.id);
                    return timeA - timeB;
                });

                // İlk kaydı tut, geri kalanını sil
                const toDelete = tcScans.slice(1);
                companyDuplicates.push(...toDelete);
            }
        });

        if (companyDuplicates.length > 0) {
            console.log(`   ⚠️  Mükerrer TC: ${duplicateCount}`);
            console.log(`   🗑️  Silinecek: ${companyDuplicates.length}`);
            allDuplicates.push(...companyDuplicates);
        } else {
            console.log(`   ✅ Mükerrer yok`);
        }

        companyStats[companyName] = {
            total: scans.length,
            unique: uniqueTCs,
            duplicates: companyDuplicates.length
        };
    }

    console.log(`\n\n📊 GENEL ÖZET:`);
    console.log(`   Toplam okutma: ${eventScans.length}`);
    console.log(`   Toplam mükerrer: ${allDuplicates.length}`);
    console.log(`   Temizlendikten sonra: ${eventScans.length - allDuplicates.length}`);
    console.log(`   Hedef: ${event.targetCount}`);
    console.log(`   Fark: ${(eventScans.length - allDuplicates.length) - event.targetCount}`);

    if (allDuplicates.length === 0) {
        console.log(`\n✅ Hiç mükerrer kayıt yok!`);
        process.exit(0);
    }

    console.log(`\n\n🗑️  TOPLAM ${allDuplicates.length} MÜKERRER KAYIT SİLİNECEK!`);
    console.log(`\nİlk 10 kayıt:`);
    allDuplicates.slice(0, 10).forEach((s, i) => {
        console.log(`   ${i + 1}. [${s.companyName}] TC: ${s.citizen?.tc}, Ad: ${s.citizen?.name} ${s.citizen?.surname}`);
    });
    if (allDuplicates.length > 10) {
        console.log(`   ... ve ${allDuplicates.length - 10} kayıt daha`);
    }

    console.log(`\n⚠️  ONAY GEREKLİ: Bu ${allDuplicates.length} MÜKERRER kayıt silinecek!`);
    console.log(`   Devam etmek için 10 saniye bekleniyor...`);

    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`\n🔄 Silme işlemi başlıyor...`);

    // Şirket bazlı sayaçları hesapla
    const companyDecrements = {};
    const userDecrements = {};
    const companyUserDecrements = {};

    allDuplicates.forEach(scan => {
        const company = scan.companyName;
        const user = scan.recordedBy || 'Bilinmiyor';

        if (company) {
            const safeCompany = company.replace(/\./g, '_');
            companyDecrements[safeCompany] = (companyDecrements[safeCompany] || 0) + 1;

            const safeUser = user.replace(/\./g, '_');
            const key = `${safeCompany}__${safeUser}`;
            companyUserDecrements[key] = (companyUserDecrements[key] || 0) + 1;
        }

        userDecrements[user] = (userDecrements[user] || 0) + 1;
    });

    // Kayıtları sil
    let deletedCount = 0;
    for (const scan of allDuplicates) {
        await deleteDoc(doc(db, 'scanned_entries', scan.id));
        deletedCount++;
        if (deletedCount % 50 === 0) {
            console.log(`   ${deletedCount}/${allDuplicates.length} silindi...`);
        }
    }

    console.log(`✅ ${deletedCount} mükerrer kayıt silindi.`);

    // Event sayaçlarını güncelle
    console.log(`\n🔄 Event sayaçları güncelleniyor...`);

    const updates = {
        currentCount: increment(-allDuplicates.length)
    };

    // Company counts
    Object.entries(companyDecrements).forEach(([company, count]) => {
        updates[`companyCounts.${company}`] = increment(-count);
    });

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

    console.log(`\n\n🎉 İşlem tamamlandı!`);
    console.log(`\n📊 ŞİRKET BAZLI SONUÇ:`);
    Object.entries(companyStats).forEach(([company, stats]) => {
        const final = stats.unique;
        const target = event.companies?.find(c => c.name === company)?.count || '?';
        const status = stats.duplicates > 0 ? '✅ TEMİZLENDİ' : '✅ ZATEN DOĞRU';
        console.log(`   ${company}:`);
        console.log(`      ${stats.total} → ${final} / ${target} ${status}`);
    });

    const finalTotal = eventScans.length - allDuplicates.length;
    console.log(`\n📊 TOPLAM: ${finalTotal}/${event.targetCount}`);

    process.exit(0);
}

deleteAllDuplicates().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
