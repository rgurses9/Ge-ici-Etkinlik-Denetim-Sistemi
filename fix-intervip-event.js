import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'fs';

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

async function run() {
    const eventId = "17806664379568118";
    const oldCompanyName = "İntervip Security Güvenlik Hizm. Ltd. Şti.";
    const newCompanyName220 = "İntervip Security Güvenlik Hizm. Ltd. Şti. (220)";
    const newCompanyName40 = "İntervip Security Güvenlik Hizm. Ltd. Şti. (40)";

    console.log(`🔧 Event "${eventId}" için İntervip Security şirketi düzeltmesi başlıyor...`);

    // 1. Get the Event Document
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) {
        console.error("❌ Etkinlik bulunamadı!");
        process.exit(1);
    }
    const eventData = eventSnap.data();

    // 2. Update Companies in Event
    const updatedCompanies = eventData.companies.map(c => {
        if (c.name === oldCompanyName) {
            if (c.count === 220) return { ...c, name: newCompanyName220 };
            if (c.count === 40) return { ...c, name: newCompanyName40 };
        }
        return c;
    });

    console.log("📝 Güncellenmiş şirketler:", updatedCompanies);

    // 3. Find scanned entries for this event with the old company name
    const q = collection(db, 'scanned_entries');
    const querySnapshot = await getDocs(q);
    const entriesToUpdate = [];
    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.eventId === eventId && data.companyName === oldCompanyName) {
            entriesToUpdate.push({ id: doc.id, ref: doc.ref });
        }
    });

    console.log(`🔍 Güncellenecek okutma sayısı: ${entriesToUpdate.length}`);

    // 4. Update Scanned Entries in Batch
    if (entriesToUpdate.length > 0) {
        const batch = writeBatch(db);
        entriesToUpdate.forEach(item => {
            batch.update(item.ref, { companyName: newCompanyName220 });
        });
        await batch.commit();
        console.log(`✅ ${entriesToUpdate.length} adet okutmanın şirketi "${newCompanyName220}" olarak güncellendi.`);
    }

    // 5. Recalculate event counters (currentCount, companyCounts, companyUserCounts, userCounts)
    const refreshedQuerySnapshot = await getDocs(q);
    const eventScans = [];
    refreshedQuerySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.eventId === eventId) {
            eventScans.push(data);
        }
    });

    const companyCounts = {};
    const companyUserCounts = {};
    const userCounts = {};

    eventScans.forEach(scan => {
        const user = scan.recordedBy || 'Bilinmiyor';
        const company = scan.companyName;

        userCounts[user] = (userCounts[user] || 0) + 1;

        if (company) {
            const safeCompany = company.replace(/\./g, '_');
            const safeUser = user.replace(/\./g, '_');

            companyCounts[safeCompany] = (companyCounts[safeCompany] || 0) + 1;

            const key = `${safeCompany}__${safeUser}`;
            companyUserCounts[key] = (companyUserCounts[key] || 0) + 1;
        }
    });

    // Make sure we have 0 for the 40-person target if it has no scans
    const safeCompany40 = newCompanyName40.replace(/\./g, '_');
    if (!companyCounts[safeCompany40]) {
        companyCounts[safeCompany40] = 0;
    }

    console.log("📊 Yeni CompanyCounts:", companyCounts);
    console.log("📊 Yeni CompanyUserCounts:", companyUserCounts);

    const updates = {
        companies: updatedCompanies,
        currentCount: eventScans.length,
        companyCounts: companyCounts,
        companyUserCounts: companyUserCounts,
        userCounts: userCounts
    };

    await updateDoc(eventRef, updates);
    console.log("🎉 Tüm güncellemeler başarıyla tamamlandı!");
    process.exit(0);
}

run().catch(err => {
    console.error("❌ Hata:", err);
    process.exit(1);
});
