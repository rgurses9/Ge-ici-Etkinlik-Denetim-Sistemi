import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// Firebase configuration - Environment variables ile (fallback değerlerle)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAxX-0LB1tZghmjdRyw5mgS9dHeJu2t7-8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gecicidenetlemeyenisi.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://gecicidenetlemeyenisi-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gecicidenetlemeyenisi",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gecicidenetlemeyenisi.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "363518576134",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:363518576134:web:906583e051db5d7a27a587",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CYXC3PTEZE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Realtime Database (with error handling)
let realtimeDb;
try {
  realtimeDb = getDatabase(app);
  console.log('✅ Realtime Database initialized');
} catch (error) {
  console.warn('⚠️ Realtime Database initialization failed (non-critical):', error);
  realtimeDb = null;
}

// Initialize Analytics (only in browser environment)
let analytics;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('⚠️ Analytics initialization failed:', error);
  }
}

export { db, realtimeDb, analytics };