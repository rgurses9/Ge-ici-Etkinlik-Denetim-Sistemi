# Firebase Realtime Database Kuralları Güncelleme

Çevrimiçi kullanıcı sayısı özelliğinin çalışması için Firebase Realtime Database kurallarını güncellemeniz gerekiyor.

## ⚠️ ÖNEMLİ: Doğru Kurallar

Firebase Realtime Database, Firestore'dan farklı bir kural formatı kullanır. Aşağıdaki kuralları **AYNEN** kopyalayın:

## Adımlar:

1. **Firebase Console'a gidin**: https://console.firebase.google.com/
2. Projenizi seçin: `gecicidenetlemeyenisi`
3. Sol menüden **"Realtime Database"** seçeneğine tıklayın
4. **"Rules"** (Kurallar) sekmesine tıklayın
5. **Tüm mevcut kuralları silin** ve aşağıdaki kuralları yapıştırın:

```json
{
  "rules": {
    "presence": {
      ".read": true,
      ".write": true
    }
  }
}
```

6. **"Publish"** (Yayınla) butonuna tıklayın

## Açıklama:

- `"presence"` node'u altında kullanıcıların çevrimiçi durumu saklanır
- `.read: true` - Herkes çevrimiçi kullanıcı sayısını okuyabilir (login ekranında gösterilmek için)
- `.write: true` - Giriş yapan kullanıcılar kendi presence kaydını oluşturabilir

## Test:

Kuralları güncelledikten sonra:
1. Uygulamayı yenileyin (F5)
2. Bir kullanıcı ile giriş yapın
3. Başka bir tarayıcı veya gizli pencerede login ekranını açın
4. "**1 Çevrimiçi Kullanıcı**" yazısını görmelisiniz

## 🔒 Gelişmiş Güvenlik (Opsiyonel)

Daha güvenli kurallar için (tüm veritabanını korur):

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "presence": {
      ".read": true,
      ".write": true
    }
  }
}
```

Bu kurallar:
- Varsayılan olarak tüm okuma/yazma işlemlerini engeller
- Sadece `presence` node'una okuma/yazma izni verir

## 🐛 Sorun Giderme

### Hata: "mismatched input '{' expecting..."
- **Çözüm**: Kuralları kopyalarken **tüm metni** seçtiğinizden emin olun
- JSON formatının bozulmadığından emin olun
- Tüm süslü parantezlerin `{` `}` doğru kapandığından emin olun

### Hala "0 Çevrimiçi Kullanıcı" gösteriyorsa:
1. Tarayıcı konsolunu açın (F12)
2. `PERMISSION_DENIED` hatası var mı kontrol edin
3. Kuralları doğru yapıştırdığınızdan emin olun
4. Sayfayı yenileyin (F5)
5. Giriş yapın ve tekrar kontrol edin
