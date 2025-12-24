# 🔐 Firebase Güvenlik Rehberi

## ✅ Yapılan Güvenlik İyileştirmeleri

### 1. Environment Variables Kullanımı

Firebase config bilgileri artık kodda değil, environment variables'da saklanıyor:

#### Dosyalar:
- ✅ **`.env.local`** - Uygulama için Firebase config (Git'e commit edilmez)
- ✅ **`.env.migration`** - Migration için Firebase config (Git'e commit edilmez)
- ✅ **`.env.migration.example`** - Template dosyası (Git'e commit edilir)

### 2. .gitignore Güncellemeleri

Hassas dosyalar Git'e commit edilmeyecek:

```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.migration

# Migration files
migration-progress.json
migration-log.txt
migration-stdout.log
migration-stderr.log
```

### 3. Firebase Config Temizliği

**Önceki Durum** (❌ Güvensiz):
```typescript
const firebaseConfig = {
  apiKey: "AIzaSy...", // Hardcoded!
  authDomain: "project.firebaseapp.com",
  // ...
};
```

**Yeni Durum** (✅ Güvenli):
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // Environment variable
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ...
};
```

---

## 📝 Kurulum Talimatları

### 1. .env.local Dosyası Oluşturun

Dosya zaten mevcut ama kontrol edin:

```bash
ls -la .env.local
```

Eğer yoksa oluşturun:

```bash
cat > .env.local << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyAxX-0LB1tZghmjdRyw5mgS9dHeJu2t7-8
VITE_FIREBASE_AUTH_DOMAIN=gecicidenetlemeyenisi.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://gecicidenetlemeyenisi-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=gecicidenetlemeyenisi
VITE_FIREBASE_STORAGE_BUCKET=gecicidenetlemeyenisi.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=363518576134
VITE_FIREBASE_APP_ID=1:363518576134:web:906583e051db5d7a27a587
VITE_FIREBASE_MEASUREMENT_ID=G-CYXC3PTEZE
EOF
```

### 2. .env.migration Dosyası Oluşturun (Migration İçin)

```bash
cp .env.migration.example .env.migration
```

Sonra `.env.migration` dosyasını düzenleyin ve gerçek değerleri girin.

---

## 🚨 Güvenlik Kontrol Listesi

### Yapılması Gerekenler ✅

- [x] `.env.local` dosyası `.gitignore`'da
- [x] `.env.migration` dosyası `.gitignore`'da
- [x] `firebase.ts` dosyasında hardcoded değerler yok
- [x] Migration scriptleri environment variables kullanıyor
- [x] `.env.*.example` dosyaları template olarak mevcut

### Yapılmaması Gerekenler ❌

- [ ] ❌ `.env.local` dosyasını Git'e commit etmeyin
- [ ] ❌ `.env.migration` dosyasını Git'e commit etmeyin
- [ ] ❌ API key'leri kodda hardcode etmeyin
- [ ] ❌ Firebase config'i public repository'de paylaşmayın

---

## 🔒 Firebase Security Rules

Yeni Firebase projenizde (gecicidenetlemeyenisi) güvenlik kurallarını güncelleyin:

### Geçici Rules (Migration İçin)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Geçici - migration için
    }
  }
}
```

### Üretim Rules (Migration Sonrası)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users koleksiyonu
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Events koleksiyonu
    match /events/{eventId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Scanned entries koleksiyonu
    match /scanned_entries/{entryId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📦 Vercel/Production Deployment

### Environment Variables Ekleme

Vercel'de deployment yaparken environment variables'ı ekleyin:

1. Vercel Dashboard → Projeniz → Settings → Environment Variables
2. Şu değişkenleri ekleyin:

```
VITE_FIREBASE_API_KEY=AIzaSyAxX-0LB1tZghmjdRyw5mgS9dHeJu2t7-8
VITE_FIREBASE_AUTH_DOMAIN=gecicidenetlemeyenisi.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://gecicidenetlemeyenisi-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=gecicidenetlemeyenisi
VITE_FIREBASE_STORAGE_BUCKET=gecicidenetlemeyenisi.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=363518576134
VITE_FIREBASE_APP_ID=1:363518576134:web:906583e051db5d7a27a587
VITE_FIREBASE_MEASUREMENT_ID=G-CYXC3PTEZE
```

---

## 🔍 Güvenlik Denetimi

### Git History Temizliği

Eğer daha önce hassas bilgileri commit ettiyseniz:

```bash
# Git history'den hassas dosyaları temizle
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (dikkatli kullanın!)
git push origin --force --all
```

**⚠️ Uyarı**: Bu işlem Git history'yi değiştirir. Dikkatli kullanın!

### Alternatif: BFG Repo-Cleaner

```bash
# BFG ile daha güvenli temizlik
brew install bfg
bfg --delete-files .env.local
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

---

## 📊 Güvenlik Özeti

| Özellik | Önceki Durum | Yeni Durum |
|---------|--------------|------------|
| Firebase Config | ❌ Kodda hardcoded | ✅ Environment variables |
| .env Dosyaları | ❌ Git'te | ✅ .gitignore'da |
| Migration Scripts | ❌ Hardcoded | ✅ Environment variables |
| Security Rules | 🟡 Geçici (açık) | ✅ Üretim (kısıtlı) |

---

## ✅ Sonraki Adımlar

1. **Migration Tamamlandıktan Sonra**:
   - Firebase Security Rules'ı üretim moduna alın
   - Geçici izinleri kaldırın

2. **Deployment Öncesi**:
   - Vercel environment variables'ı ekleyin
   - Production build test edin

3. **Düzenli Kontrol**:
   - API key'leri düzenli olarak rotate edin
   - Firebase Console'da kullanım loglarını kontrol edin

---

**Güvenlik Notu**: Bu rehber Firebase config'lerini güvenli hale getirdi. Ancak API key'ler hala client-side'da görünür olacak (bu normal). Gerçek güvenlik Firebase Security Rules ile sağlanır.

**Son Güncelleme**: 24 Aralık 2025
