# 🔄 Firebase Migration Otomatik Çalıştırma Rehberi

## ✅ Hazırlık Tamamlandı!

Akıllı migration sistemi kuruldu. Sistem şu özelliklere sahip:

### 🎯 Özellikler
- ✅ **İlerleme Takibi**: Taşınan dökümanlar kaydedilir
- ✅ **Kaldığı Yerden Devam**: Quota limiti aşıldığında kaldığı yerden devam eder
- ✅ **Otomatik Yeniden Deneme**: Yarın tekrar çalıştırıldığında sadece kalan kayıtları taşır
- ✅ **Log Kayıtları**: Tüm işlemler loglanır

---

## 📅 Otomatik Çalıştırma Kurulumu (Cron Job)

### Yöntem 1: macOS Launchd (Önerilen)

#### 1. Launchd Plist Dosyası Oluşturun

Dosya: `~/Library/LaunchAgents/com.firebase.migration.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.firebase.migration</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi/auto-migrate.sh</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi/migration-stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi/migration-stderr.log</string>
</dict>
</plist>
```

#### 2. Launchd'yi Yükleyin

```bash
launchctl load ~/Library/LaunchAgents/com.firebase.migration.plist
```

#### 3. Durumu Kontrol Edin

```bash
launchctl list | grep firebase
```

#### 4. Kaldırmak İsterseniz

```bash
launchctl unload ~/Library/LaunchAgents/com.firebase.migration.plist
```

---

### Yöntem 2: Cron Job (Alternatif)

#### 1. Crontab'ı Açın

```bash
crontab -e
```

#### 2. Şu Satırı Ekleyin

```bash
# Firebase Migration - Her gün saat 09:00'da çalışır
0 9 * * * /Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi/auto-migrate.sh
```

#### 3. Kaydet ve Çık

- Vim kullanıyorsanız: `ESC` → `:wq` → `ENTER`
- Nano kullanıyorsanız: `CTRL+X` → `Y` → `ENTER`

#### 4. Cron Job'ları Listeleyin

```bash
crontab -l
```

---

## 🔧 Manuel Çalıştırma

Yarın beklemek istemiyorsanız, manuel olarak çalıştırabilirsiniz:

```bash
cd /Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi
node migrate-firebase-data.js
```

Script akıllıdır:
- ✅ Daha önce taşınan kayıtları atlar
- ✅ Sadece kalan kayıtları taşır
- ✅ İlerlemeyi `migration-progress.json` dosyasında saklar

---

## 📊 İlerleme Takibi

### İlerleme Dosyası

`migration-progress.json` dosyasını kontrol edin:

```bash
cat migration-progress.json
```

Örnek çıktı:
```json
{
  "users": {
    "completed": true,
    "count": 92
  },
  "events": {
    "completed": true,
    "count": 57
  },
  "scanned_entries": {
    "completed": false,
    "count": 19000,
    "migratedIds": ["id1", "id2", ...]
  }
}
```

### Log Dosyası

```bash
tail -f migration-log.txt
```

---

## 🎯 Şu Anki Durum

### ✅ Taşınan Veriler
- **users**: 92 / 92 (100%)
- **events**: 57 / 57 (100%)
- **scanned_entries**: ~19,000 / 23,905 (79%)

### 🔄 Kalan İşlem
- **scanned_entries**: ~4,905 kayıt (yarın otomatik taşınacak)

---

## 🚀 Sistem Kullanıma Hazır!

Şu anda sistem kullanılabilir durumda:
- ✅ Tüm kullanıcılar mevcut
- ✅ Tüm etkinlikler mevcut
- ✅ Scanned entries'in %79'u mevcut

Localhost'ta test edin:
```
http://localhost:5174/
Kullanıcı: rgurses
Şifre: rgurses9
```

---

## ❓ Sık Sorulan Sorular

### Yarın otomatik çalışacak mı?
Evet, eğer Launchd veya Cron Job kurduysanız, her gün saat 09:00'da otomatik çalışacak.

### Migration tamamlandığında ne olur?
Script otomatik olarak durur ve `migration-progress.json` dosyasını siler.

### Hata olursa ne olur?
Tüm hatalar `migration-log.txt` dosyasına kaydedilir. Script güvenli bir şekilde durur ve bir sonraki çalışmada kaldığı yerden devam eder.

### Manuel test etmek istersem?
```bash
node migrate-firebase-data.js
```

---

**Son Güncelleme**: 24 Aralık 2025, 20:45
