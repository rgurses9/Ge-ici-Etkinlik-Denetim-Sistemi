# Çevrimiçi Kullanıcı Sayısı Özelliği

## ✅ Yapılan Değişiklikler

### 1. Login Ekranı (`components/Login.tsx`)
- Firebase Realtime Database'den çevrimiçi kullanıcı sayısını dinleyen bir listener eklendi
- Giriş ekranının alt kısmında "X Çevrimiçi Kullanıcı" bilgisi gösteriliyor
- Users ikonu ile birlikte görsel olarak gösteriliyor

### 2. Ana Uygulama (`App.tsx`)
- Firebase Realtime Database import'ları eklendi
- **Giriş Yapıldığında**: Kullanıcı presence kaydı oluşturuluyor
- **Çıkış Yapıldığında**: Kullanıcı presence kaydı siliniyor
- **Sayfa Yenilendiğinde**: Eğer kullanıcı zaten giriş yapmışsa presence kaydı otomatik restore ediliyor
- **Bağlantı Kesildiğinde**: Firebase `onDisconnect()` ile otomatik olarak presence kaydı siliniyor

### 3. Firebase Yapılandırması
- `firebase.ts` dosyasında Realtime Database zaten mevcuttu
- Realtime Database kurallarının güncellenmesi gerekiyor (bkz. `FIREBASE_REALTIME_DATABASE_SETUP.md`)

## 🔧 Nasıl Çalışır?

1. **Kullanıcı Giriş Yapar**:
   - `presence/{userId}` path'ine kullanıcı bilgileri yazılır
   - `onDisconnect()` ile bağlantı kesildiğinde otomatik silme ayarlanır

2. **Login Ekranı**:
   - `presence/` path'ini dinler
   - Kaç tane kullanıcı kaydı varsa o sayıyı gösterir

3. **Kullanıcı Çıkış Yapar veya Bağlantı Kesilir**:
   - Presence kaydı otomatik olarak silinir
   - Login ekranındaki sayı güncellenir

## 📋 Kurulum Adımları

1. **Firebase Realtime Database Kurallarını Güncelleyin**:
   ```bash
   # Firebase Console'da Rules sekmesine gidin
   # FIREBASE_REALTIME_DATABASE_SETUP.md dosyasındaki kuralları yapıştırın
   ```

2. **Uygulamayı Test Edin**:
   ```bash
   npm run dev
   ```

3. **Çoklu Kullanıcı Testi**:
   - Bir tarayıcıda giriş yapın
   - Başka bir tarayıcı/gizli pencerede login ekranını açın
   - "1 Çevrimiçi Kullanıcı" yazısını görmelisiniz

## 🎯 Özellikler

- ✅ Gerçek zamanlı güncelleme
- ✅ Otomatik bağlantı kesilme yönetimi
- ✅ Sayfa yenileme desteği
- ✅ Çoklu sekme/tarayıcı desteği
- ✅ Görsel ikon ile kullanıcı dostu arayüz

## 📊 Veri Yapısı

Firebase Realtime Database'de `presence` node'u:
```json
{
  "presence": {
    "user-id-1": {
      "userId": "user-id-1",
      "username": "kullanici1",
      "fullName": "Kullanıcı Bir",
      "loginTime": 1234567890,
      "lastSeen": 1234567890
    },
    "user-id-2": {
      "userId": "user-id-2",
      "username": "kullanici2",
      "fullName": "Kullanıcı İki",
      "loginTime": 1234567891,
      "lastSeen": 1234567891
    }
  }
}
```

## 🔒 Güvenlik

Şu anda basit kurallar kullanılıyor (herkes okuyabilir/yazabilir).
Üretim ortamında daha güvenli kurallar için `FIREBASE_REALTIME_DATABASE_SETUP.md` dosyasına bakın.

## 🐛 Sorun Giderme

### "0 Çevrimiçi Kullanıcı" Gösteriyorsa:
1. Firebase Console'da Realtime Database kurallarını kontrol edin
2. Tarayıcı konsolunda `PERMISSION_DENIED` hatası var mı kontrol edin
3. Firebase projesinde Realtime Database'in etkin olduğundan emin olun

### Sayı Güncellenmiyor:
1. Tarayıcı konsolunda hata var mı kontrol edin
2. Firebase Realtime Database bağlantısını kontrol edin
3. Sayfayı yenileyin (F5)
