// Firebase Migration Script - Environment Variables Kullanımı
// .env dosyasından Firebase config'leri yükler

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config({ path: '.env.migration' });

// KAYNAK FIREBASE (Eski - denetleme-devam)
const sourceConfig = {
    apiKey: process.env.SOURCE_FIREBASE_API_KEY,
    authDomain: process.env.SOURCE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.SOURCE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.SOURCE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.SOURCE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.SOURCE_FIREBASE_APP_ID,
    measurementId: process.env.SOURCE_FIREBASE_MEASUREMENT_ID
};

// HEDEF FIREBASE (Yeni - gecicidenetlemeyenisi)
const targetConfig = {
    apiKey: process.env.TARGET_FIREBASE_API_KEY,
    authDomain: process.env.TARGET_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.TARGET_FIREBASE_DATABASE_URL,
    projectId: process.env.TARGET_FIREBASE_PROJECT_ID,
    storageBucket: process.env.TARGET_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.TARGET_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.TARGET_FIREBASE_APP_ID,
    measurementId: process.env.TARGET_FIREBASE_MEASUREMENT_ID
};

// Validate configs
if (!sourceConfig.apiKey || !targetConfig.apiKey) {
    console.error('❌ Firebase configuration is missing!');
    console.error('Please create .env.migration file with required variables.');
    console.error('See .env.migration.example for template.');
    process.exit(1);
}

// İlerleme dosyası
const PROGRESS_FILE = './migration-progress.json';

// İlerlemeyi kaydet
function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// İlerlemeyi yükle
function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
    return {
        users: { completed: false, count: 0 },
        events: { completed: false, count: 0 },
        scanned_entries: { completed: false, count: 0, migratedIds: [] }
    };
}

// İki Firebase instance oluştur
const sourceApp = initializeApp(sourceConfig, 'source');
const targetApp = initializeApp(targetConfig, 'target');

const sourceDb = getFirestore(sourceApp);
const targetDb = getFirestore(targetApp);

// Koleksiyonu taşı (akıllı devam etme ile)
async function migrateCollection(collectionName, progress) {
    console.log(`\n📦 "${collectionName}" koleksiyonu taşınıyor...`);

    // Eğer daha önce tamamlanmışsa atla
    if (progress[collectionName]?.completed) {
        console.log(`   ✅ Bu koleksiyon daha önce tamamlanmış, atlanıyor.`);
        return { success: true, count: progress[collectionName].count, skipped: true };
    }

    try {
        // Kaynak koleksiyondan tüm dökümanları al
        const sourceCollection = collection(sourceDb, collectionName);
        const snapshot = await getDocs(sourceCollection);

        if (snapshot.empty) {
            console.log(`   ⚠️  Koleksiyon boş, atlanıyor.`);
            progress[collectionName] = { completed: true, count: 0 };
            saveProgress(progress);
            return { success: true, count: 0 };
        }

        console.log(`   📊 ${snapshot.size} döküman bulundu`);

        // Daha önce taşınan dökümanları filtrele
        const migratedIds = new Set(progress[collectionName]?.migratedIds || []);
        const docsToMigrate = snapshot.docs.filter(doc => !migratedIds.has(doc.id));

        if (docsToMigrate.length === 0) {
            console.log(`   ✅ Tüm dökümanlar daha önce taşınmış!`);
            progress[collectionName].completed = true;
            saveProgress(progress);
            return { success: true, count: snapshot.size, skipped: true };
        }

        console.log(`   🔄 ${docsToMigrate.length} yeni döküman taşınacak (${migratedIds.size} zaten taşınmış)`);

        // Batch işlemi için (500 döküman limiti var)
        const BATCH_SIZE = 500;
        let processedCount = 0;
        let batch = writeBatch(targetDb);
        let batchCount = 0;

        for (const docSnapshot of docsToMigrate) {
            const docData = docSnapshot.data();
            const docRef = doc(targetDb, collectionName, docSnapshot.id);

            batch.set(docRef, docData);
            batchCount++;

            // Batch limiti dolduğunda commit et
            if (batchCount >= BATCH_SIZE) {
                try {
                    await batch.commit();
                    processedCount += batchCount;

                    // İlerlemeyi kaydet
                    for (let i = processedCount - batchCount; i < processedCount; i++) {
                        migratedIds.add(docsToMigrate[i].id);
                    }
                    progress[collectionName] = {
                        completed: false,
                        count: migratedIds.size,
                        migratedIds: Array.from(migratedIds)
                    };
                    saveProgress(progress);

                    console.log(`   ✅ ${processedCount} döküman taşındı... (Toplam: ${migratedIds.size})`);
                    batch = writeBatch(targetDb);
                    batchCount = 0;
                } catch (error) {
                    if (error.code === 'resource-exhausted') {
                        console.log(`   ⚠️  Quota limiti aşıldı. İlerleme kaydedildi.`);
                        console.log(`   💾 ${migratedIds.size} döküman başarıyla taşındı.`);
                        console.log(`   🔄 Kalan ${docsToMigrate.length - processedCount} döküman yarın taşınacak.`);
                        return { success: false, count: migratedIds.size, quotaExceeded: true };
                    }
                    throw error;
                }
            }
        }

        // Kalan dökümanları commit et
        if (batchCount > 0) {
            try {
                await batch.commit();
                processedCount += batchCount;

                // İlerlemeyi kaydet
                for (let i = processedCount - batchCount; i < processedCount; i++) {
                    migratedIds.add(docsToMigrate[i].id);
                }
            } catch (error) {
                if (error.code === 'resource-exhausted') {
                    console.log(`   ⚠️  Quota limiti aşıldı. İlerleme kaydedildi.`);
                    console.log(`   💾 ${migratedIds.size} döküman başarıyla taşındı.`);
                    console.log(`   🔄 Kalan ${docsToMigrate.length - processedCount} döküman yarın taşınacak.`);
                    progress[collectionName] = {
                        completed: false,
                        count: migratedIds.size,
                        migratedIds: Array.from(migratedIds)
                    };
                    saveProgress(progress);
                    return { success: false, count: migratedIds.size, quotaExceeded: true };
                }
                throw error;
            }
        }

        // Tamamlandı olarak işaretle
        progress[collectionName] = {
            completed: true,
            count: snapshot.size,
            migratedIds: Array.from(migratedIds)
        };
        saveProgress(progress);

        console.log(`   ✅ Toplam ${snapshot.size} döküman başarıyla taşındı!`);
        return { success: true, count: snapshot.size };

    } catch (error) {
        console.error(`   ❌ Hata:`, error.message);
        return { success: false, error: error.message };
    }
}

// Ana migration fonksiyonu
async function migrateAllData() {
    console.log('🚀 Firebase Veri Taşıma İşlemi Başlatılıyor...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📤 Kaynak: ${sourceConfig.projectId}`);
    console.log(`📥 Hedef: ${targetConfig.projectId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // İlerlemeyi yükle
    const progress = loadProgress();
    console.log('📋 Önceki ilerleme yüklendi\n');

    const results = {
        users: null,
        events: null,
        scanned_entries: null
    };

    let quotaExceeded = false;

    // 1. Users koleksiyonunu taşı
    results.users = await migrateCollection('users', progress);
    if (results.users.quotaExceeded) quotaExceeded = true;

    // 2. Events koleksiyonunu taşı
    if (!quotaExceeded) {
        results.events = await migrateCollection('events', progress);
        if (results.events.quotaExceeded) quotaExceeded = true;
    }

    // 3. Scanned Entries koleksiyonunu taşı
    if (!quotaExceeded) {
        results.scanned_entries = await migrateCollection('scanned_entries', progress);
        if (results.scanned_entries.quotaExceeded) quotaExceeded = true;
    }

    // Özet rapor
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TAŞIMA RAPORU');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let totalSuccess = 0;
    let totalFailed = 0;

    Object.entries(results).forEach(([name, result]) => {
        if (!result) {
            console.log(`⏭️  ${name}: Atlandı (quota limiti)`);
        } else if (result.success || result.skipped) {
            console.log(`✅ ${name}: ${result.count} döküman${result.skipped ? ' (daha önce tamamlanmış)' : ''}`);
            totalSuccess += result.count;
        } else if (result.quotaExceeded) {
            console.log(`🟡 ${name}: ${result.count} döküman (quota limiti - devam edecek)`);
            totalSuccess += result.count;
        } else {
            console.log(`❌ ${name}: HATA - ${result.error}`);
            totalFailed++;
        }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Toplam Taşınan: ${totalSuccess} döküman`);

    if (quotaExceeded) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  Firebase Quota Limiti Aşıldı!');
        console.log('💡 Çözüm: Bu scripti yarın tekrar çalıştırın:');
        console.log('   node migrate-firebase-data.js');
    } else if (totalFailed === 0) {
        console.log('🎉 Tüm veriler başarıyla taşındı!');
        // İlerleme dosyasını temizle
        if (fs.existsSync(PROGRESS_FILE)) {
            fs.unlinkSync(PROGRESS_FILE);
            console.log('🗑️  İlerleme dosyası temizlendi.');
        }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(quotaExceeded ? 1 : 0);
}

// Migration'ı başlat
migrateAllData().catch(error => {
    console.error('💥 Kritik Hata:', error);
    process.exit(1);
});
