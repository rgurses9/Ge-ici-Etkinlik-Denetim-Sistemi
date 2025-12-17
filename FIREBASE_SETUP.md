# Firebase Yapılandırma Kılavuzu

## 🔐 Güvenlik Önlemleri

Firebase API anahtarları artık environment variable'larda saklanıyor. Bu sayede:
- ✅ Hassas bilgiler Git'e eklenmez
- ✅ Farklı ortamlar için farklı yapılandırmalar kullanılabilir
- ✅ API anahtarları kolayca değiştirilebilir

## 📋 Kurulum Adımları

### 1. Environment Dosyasını Oluşturun

Proje kök dizininde `.env.local` dosyası oluşturun:

```bash
# Proje dizininde
touch .env.local
```

### 2. Firebase Bilgilerini Ekleyin

`.env.local` dosyasına aşağıdaki içeriği kopyalayın:

```env
# Firebase Configuration - denetleme-devam projesi
VITE_FIREBASE_API_KEY=AIzaSyCdDR19Aq8xSP3TNH3FVeSgVOwhn-96wBg
VITE_FIREBASE_AUTH_DOMAIN=denetleme-devam.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=denetleme-devam
VITE_FIREBASE_STORAGE_BUCKET=denetleme-devam.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=833897901550
VITE_FIREBASE_APP_ID=1:833897901550:web:0cf25230715f92c43672ff
VITE_FIREBASE_MEASUREMENT_ID=G-R5XC5VMGBT

# Google Sheets Configuration
VITE_SPREADSHEET_ID=1FD25QgwnS8AvtlZc-ZWzbF0wKW-4kxRhQft0VkST8Ng
VITE_SHEET_GID=893430437
```

### 3. Uygulamayı Başlatın

```bash
npm run dev
```

## 🚀 Vercel Deployment

Vercel'e deploy ederken environment variable'ları manuel olarak eklemeniz gerekiyor:

1. Vercel Dashboard'a gidin
2. Projenizi seçin
3. **Settings** > **Environment Variables** bölümüne gidin
4. `.env.vercel` dosyasındaki tüm değişkenleri ekleyin

## 🔥 Firebase CLI Kullanımı

### Firebase'e Giriş Yapma

```bash
npm run firebase:login
```

veya global kurulum yaptıysanız:

```bash
firebase login
```

### Firebase Hosting Kurulumu

```bash
npm run firebase:init
```

Kurulum sırasında:
- ✅ **Hosting** seçin
- ✅ **Use an existing project** seçin
- ✅ **denetleme-devam** projesini seçin
- ✅ Public directory: `dist`
- ✅ Single-page app: `Yes`
- ✅ Automatic builds with GitHub: `No` (isterseniz Yes)

### Firebase'e Deploy

```bash
# Önce build edin
npm run build

# Sonra deploy edin
npm run firebase:deploy
```

### Lokal Test (Firebase Hosting)

```bash
npm run build
npm run firebase:serve
```

## ⚠️ Önemli Notlar

- ✅ `.env.local` dosyası **asla** Git'e eklenmez (`.gitignore` tarafından korunur)
- ✅ `.env.example` dosyası şablon olarak Git'e eklenmiştir
- ✅ `.env.vercel` dosyası sadece referans amaçlıdır
- ⚠️ API anahtarlarını **asla** doğrudan kodda yazmayın
- ⚠️ `.env.local` dosyasını **asla** kimseyle paylaşmayın

## 🔄 Firebase Projesi Değiştirme

Farklı bir Firebase projesi kullanmak için:

1. `.env.local` dosyasındaki değerleri güncelleyin
2. Uygulamayı yeniden başlatın (`npm run dev`)

## 📚 Daha Fazla Bilgi

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Firebase Web Setup](https://firebase.google.com/docs/web/setup)
