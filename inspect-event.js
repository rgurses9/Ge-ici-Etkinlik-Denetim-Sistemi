import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function inspect() {
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const events = eventsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.name.includes('Sıfır Atık'));

    console.log(JSON.stringify(events, null, 2));
    process.exit(0);
}

inspect().catch(err => {
    console.error(err);
    process.exit(1);
});
