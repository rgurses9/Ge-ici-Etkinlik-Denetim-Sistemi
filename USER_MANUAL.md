# Geçici Etkinlik Denetim Sistemi - Kullanım Kılavuzu

Bu belge, Geçici Etkinlik Denetim Sistemi'nin (GEDS) kullanımı, özellikleri ve rol tabanlı yetkilerini detaylandırmak amacıyla hazırlanmıştır.

---

## 1. Amaç ve Kapsam

**Amaç:**
Bu dokümanın amacı; Geçici Etkinlik Denetim Sistemi'nin (GEDS) etkin kullanımı, yönetimi ve sürdürülebilirliği konusunda kullanıcıları bilgilendirmektir. Sistem; etkinliklerde görev alacak personelin kimlik doğrulaması, geçerlilik süresi kontrolü, belirlenen kotalara uyulması ve aynı kişinin çakışan saatlerdeki farklı etkinliklerde mükerrer görev almasının engellenmesi amacıyla geliştirilmiştir.

**Kapsam:**
Bu kullanım kılavuzu; sisteme güvenli giriş prosedürlerini, kullanıcı ve yetki yönetimini, etkinlik oluşturma ve sonlandırma süreçlerini, TC Kimlik Numarası ile anlık denetim işlemlerini, veritabanı sorgulama kurallarını, Excel raporlama fonksiyonlarını ve cihazlar arası canlı veri senkronizasyonu özelliklerini kapsar.

---

## 2. Giriş İşlemleri

Sisteme iki farklı yetki seviyesi ile giriş yapılabilir.

### Giriş Ekranı
- **Kullanıcı Girişi:** Saha personeli için tasarlanmıştır.
- **Yönetici Girişi:** Tam yetkili sistem yöneticileri için tasarlanmıştır.

> **Not:** Giriş yaparken üst kısımdaki sekmelerden uygun rolü ("Kullanıcı Girişi" veya "Yönetici Girişi") seçtiğinizden emin olun. Yetkiniz olmayan bir alandan giriş yapmaya çalışırsanız sistem hata verecektir.

---

## 3. Yönetici (Admin) Kılavuzu

Yönetici, sistemin tüm fonksiyonlarına erişim hakkına sahiptir.

### 3.1. Ana Panel (Dashboard)
Giriş yapıldığında karşılaşılan ana ekrandır.
- **Aktif Denetimler:** Şu anda devam eden veya başlamaya hazır etkinlikleri listeler.
- **Devam Eden Denetimler:** İçerisine kayıt yapılmaya başlanmış ancak henüz bitirilmemiş etkinliklerin hızlı erişim kartlarıdır.
- **Pasif Etkinlikler:** Hedef sayısına ulaşılmış veya manuel olarak bitirilmiş, arşive kaldırılmış etkinliklerdir.
- **Canlı Trafik:** Sağ üst köşedeki bu ibare, farklı bilgisayarlarda yapılan işlemlerin anlık olarak senkronize edildiğini gösterir.

### 3.2. Etkinlik Yönetimi
- **Etkinlik Ekle:** "Etkinlikler" sekmesinde bulunan **"+ Etkinlik Ekle"** butonuna tıklayarak yeni bir etkinlik oluşturabilirsiniz.
  - *İsim, Hedef Kişi Sayısı, Başlangıç ve Bitiş Tarihleri* girilmelidir.
- **Etkinlik Silme:** Aktif etkinlik kartının sağındaki **Çöp Kutusu** ikonuna basarak etkinliği silebilirsiniz.
- **Etkinliği Bitirme/Pasife Alma:** Bir denetim ekranında "Denetimi Bitir" butonuna basıldığında etkinlik otomatik olarak **Pasif Etkinlikler** bölümüne düşer.
- **Etkinliği Tekrar Aktif Etme:** Pasif etkinlikler listesinde bulunan **Yenile (Mavi Ok)** ikonuna basarak kapalı bir etkinliği tekrar aktif hale getirebilir ve denetime açabilirsiniz.

### 3.3. Kullanıcı Yönetimi
Üst menüdeki **"Kullanıcılar"** sekmesinden erişilir (Sadece Yönetici görebilir).
- **Kullanıcı Ekle:** "+ Kullanıcı Ekle" butonu ile yeni personel veya yönetici tanımlayabilirsiniz.
- **Yetki Düzenleme:** "Düzenle" butonu ile bir kullanıcının rolünü (Yönetici/Kullanıcı) değiştirebilirsiniz. Bir kullanıcıya her iki yetkiyi de verebilirsiniz.
- **Şifre Sıfırlama:** Kullanıcıların unuttuğu şifreleri buradan güncelleyebilirsiniz.

### 3.4. Denetim Ekranı (Yönetici Özellikleri)
Yönetici, denetim ekranında Kullanıcılardan farklı olarak şu ek özelliğe sahiptir:
- **Excel Yükle:** TC Kimlik Numarası girilen alanın yanındaki yeşil buton ile toplu liste yükleyebilir. Yüklenen Excel listesindeki TC'ler kurallara (çakışma, mükerrer kayıt vb.) göre kontrol edilip içeri aktarılır.

---

## 4. Kullanıcı (Personel) Kılavuzu

Kullanıcılar, sadece kendilerine atanan denetim görevini yerine getirmekle yükümlüdür.

### 4.1. Kısıtlamalar
- Yeni etkinlik oluşturamaz veya silemezler.
- Kullanıcı ekleyemez veya düzenleyemezler.
- Toplu Excel yüklemesi yapamazlar.
- Pasif etkinlikleri tekrar açamazlar.

### 4.2. Denetim Başlatma
1. Ana ekranda **"Denetim Başlat"** bölümüne gelin.
2. Açılır menüden görevli olduğunuz etkinliği seçin.
3. **"Denetimi Başlat"** butonuna tıklayın.

### 4.3. Kimlik Kontrol ve Kayıt (TC Okutma)
Denetim ekranında TC Kimlik Numarası girilir veya okutulur.

**Sistem şu kontrolleri yapar:**
1. **Veritabanı Kontrolü:**
   - **Yeşil Uyarı:** Kişi veritabanında kayıtlıdır ve geçerlilik tarihi uygundur.
   - **Kırmızı Uyarı (Veritabanında Bulunamadı):** Kişi veritabanında yoktur. Sistem yine de kaydeder ancak *"Kimlik kartının geçerlilik süresini kontrol et"* uyarısı verir.
2. **Çakışma Kontrolü:**
   - Eğer kişi o anda **başka bir aktif etkinlikte** kayıtlıysa sistem kaydı reddeder ve *"Bu TC ... etkinliğinde okutuldu"* uyarısı verir.
   - Eğer kişinin kayıtlı olduğu başka bir etkinlik ile şu anki etkinlik saatleri çakışıyorsa sistem kaydı reddeder.
3. **Hedef Kotası:**
   - Etkinlik için belirlenen hedef sayıya ulaşıldığında (Örn: 50/50), sistem yeni kayıt almayı durdurur.

### 4.4. Denetimi Bitirme
- Hedef sayıya ulaşıldığında "Denetimi Bitir" butonu aktif olur.
- Bu butona basıldığında:
  1. O ana kadar okutulan liste otomatik olarak **Excel** formatında indirilir.
  2. Ekrana denetimin ne kadar sürdüğünü gösteren bir özet gelir.
  3. Ana ekrana dönüldüğünde etkinlik **Pasif** duruma geçer.

---

## 5. İpuçları ve Uyarılar

- **İnternet Bağlantısı:** Sistem Google E-Tablolar üzerinden veritabanını çeker. İnternet kesilirse sistem yerel (mock) verilerle çalışmaya devam eder ancak veritabanı güncelliği garanti edilemez.
- **Gerçek Zamanlı Çalışma:** Bir bilgisayarda yapılan TC okutma işlemi, aynı sisteme bağlı diğer tüm bilgisayarlarda anlık olarak güncellenir. Sayfayı yenilemenize gerek yoktur.
- **Hatalı Kayıt Silme:** Okutulan kişiler listesinde, her satırın en sağındaki **Çöp Kutusu** ikonuna basarak hatalı girişleri silebilirsiniz. Silinen kayıt kotadan düşülür.