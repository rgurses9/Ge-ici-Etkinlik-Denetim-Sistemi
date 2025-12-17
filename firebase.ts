import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration - Güvenlik için environment variables kullanılıyor
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCdDR19Aq8xSP3TNH3FVeSgVOwhn-96wBg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "denetleme-devam.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "denetleme-devam",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "denetleme-devam.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "833897901550",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:833897901550:web:0cf25230715f92c43672ff",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-R5XC5VMGBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Analytics (only in browser environment)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { db, analytics };