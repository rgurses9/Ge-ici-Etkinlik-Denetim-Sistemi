import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBnSG0V370gNnKPTwfb2tZTi6MEqF5pHUA",
  authDomain: "denetleme-1f271.firebaseapp.com",
  databaseURL: "https://denetleme-1f271-default-rtdb.firebaseio.com",
  projectId: "denetleme-1f271",
  storageBucket: "denetleme-1f271.firebasestorage.app",
  messagingSenderId: "276489440280",
  appId: "1:276489440280:web:a5510870538ddd8ba2476d",
  measurementId: "G-LKQQQ08VCM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };