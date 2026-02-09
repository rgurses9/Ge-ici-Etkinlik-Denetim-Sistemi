import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error: any) {
  // If Firebase app already exists during HMR, use the existing one
  if (error.code === 'app/duplicate-app') {
    const { getApp } = await import('firebase/app');
    app = getApp();
  } else {
    throw error;
  }
}

const db = getFirestore(app);

export { db };