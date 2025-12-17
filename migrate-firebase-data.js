/**
 * Firebase Data Migration Script
 * Eski Firebase projesinden (denetleme-1f271) yeni projeye (denetleme-devam) veri taşıma
 * 
 * KULLANIM:
 * 1. Node.js ile çalıştırın: node migrate-firebase-data.js
 * 2. Veya npm script ile: npm run migrate:firebase
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

// ESKİ Firebase Config (denetleme-1f271)
const oldFirebaseConfig = {
    apiKey: "AIzaSyBnSG0V370gNnKPTwfb2tZTi6MEqF5pHUA",
    authDomain: "denetleme-1f271.firebaseapp.com",
    projectId: "denetleme-1f271",
    storageBucket: "denetleme-1f271.firebasestorage.app",
    messagingSenderId: "276489440280",
    appId: "1:276489440280:web:a5510870538ddd8ba2476d"
};

// YENİ Firebase Config (denetleme-devam)
const newFirebaseConfig = {
    apiKey: "AIzaSyCdDR19Aq8xSP3TNH3FVeSgVOwhn-96wBg",
    authDomain: "denetleme-devam.firebaseapp.com",
    projectId: "denetleme-devam",
    storageBucket: "denetleme-devam.firebasestorage.app",
    messagingSenderId: "833897901550",
    appId: "1:833897901550:web:0cf25230715f92c43672ff"
};

// Initialize Firebase Apps
const oldApp = initializeApp(oldFirebaseConfig, 'old');
const newApp = initializeApp(newFirebaseConfig, 'new');

const oldDb = getFirestore(oldApp);
const newDb = getFirestore(newApp);

async function migrateCollection(collectionName) {
    console.log(`\n📦 Migrating collection: ${collectionName}`);

    try {
        // Eski database'den veriyi oku
        const oldCollectionRef = collection(oldDb, collectionName);
        const snapshot = await getDocs(oldCollectionRef);

        if (snapshot.empty) {
            console.log(`⚠️  Collection '${collectionName}' is empty, skipping...`);
            return { success: 0, failed: 0 };
        }

        console.log(`📊 Found ${snapshot.size} documents in '${collectionName}'`);

        let successCount = 0;
        let failedCount = 0;

        // Her document'i yeni database'e yaz
        for (const docSnapshot of snapshot.docs) {
            try {
                const data = docSnapshot.data();
                const docId = docSnapshot.id;

                // Yeni database'e yaz
                await setDoc(doc(newDb, collectionName, docId), data);

                successCount++;
                console.log(`  ✅ Migrated: ${docId}`);
            } catch (error) {
                failedCount++;
                console.error(`  ❌ Failed to migrate ${docSnapshot.id}:`, error.message);
            }
        }

        console.log(`\n✨ Migration completed for '${collectionName}':`);
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Failed: ${failedCount}`);

        return { success: successCount, failed: failedCount };
    } catch (error) {
        console.error(`❌ Error migrating collection '${collectionName}':`, error);
        return { success: 0, failed: 0 };
    }
}

async function migrateAllData() {
    console.log('🚀 Starting Firebase Data Migration...');
    console.log('📍 From: denetleme-1f271');
    console.log('📍 To: denetleme-devam');
    console.log('='.repeat(50));

    const collections = ['users', 'events', 'scanned_entries'];
    const results = {};

    for (const collectionName of collections) {
        results[collectionName] = await migrateCollection(collectionName);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Migration Summary:');
    console.log('='.repeat(50));

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const [collectionName, result] of Object.entries(results)) {
        console.log(`\n📦 ${collectionName}:`);
        console.log(`   ✅ Success: ${result.success}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        totalSuccess += result.success;
        totalFailed += result.failed;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Total Documents Migrated: ${totalSuccess}`);
    console.log(`❌ Total Failed: ${totalFailed}`);
    console.log('='.repeat(50));

    if (totalFailed === 0) {
        console.log('\n✅ Migration completed successfully! 🎊');
    } else {
        console.log('\n⚠️  Migration completed with some errors. Please review the logs above.');
    }
}

// Run migration
migrateAllData()
    .then(() => {
        console.log('\n👋 Migration script finished.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
