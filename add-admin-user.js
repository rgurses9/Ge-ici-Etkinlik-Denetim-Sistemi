// Firebase'e admin kullanıcısı ekleme scripti
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCdDR19Aq8xSP3TNH3FVeSgVOwhn-96wBg",
    authDomain: "denetleme-devam.firebaseapp.com",
    projectId: "denetleme-devam",
    storageBucket: "denetleme-devam.firebasestorage.app",
    messagingSenderId: "833897901550",
    appId: "1:833897901550:web:0cf25230715f92c43672ff",
    measurementId: "G-R5XC5VMGBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addAdminUser() {
    console.log('🔐 Admin kullanıcısı ekleniyor...');

    const adminUser = {
        id: '3',
        username: 'rgurses',
        password: 'rgurses9',
        roles: ['ADMIN', 'PERSONNEL'],
        fullName: 'Rıfat Gürses'
    };

    try {
        await setDoc(doc(db, 'users', adminUser.id), adminUser);
        console.log('✅ Admin kullanıcısı başarıyla eklendi!');
        console.log('📋 Kullanıcı Bilgileri:');
        console.log('   Kullanıcı Adı: rgurses');
        console.log('   Şifre: rgurses9');
        console.log('   Yetki: ADMIN + PERSONNEL');
        console.log('   Tam Ad: Rıfat Gürses');
    } catch (error) {
        console.error('❌ Hata:', error);
    }

    process.exit(0);
}

addAdminUser();
