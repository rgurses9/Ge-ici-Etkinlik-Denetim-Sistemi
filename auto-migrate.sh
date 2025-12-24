#!/bin/bash

# Firebase Migration Otomatik Çalıştırma Scripti
# Bu script her gün saat 09:00'da otomatik olarak çalışır

# Proje dizini
PROJECT_DIR="/Users/rifatgurses/Documents/GitHub/Ge-ici-Etkinlik-Denetim-Sistemi"

# Log dosyası
LOG_FILE="$PROJECT_DIR/migration-log.txt"

# Tarih damgası
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
echo "🕐 Migration başlatıldı: $(date)" >> "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"

# Proje dizinine git
cd "$PROJECT_DIR" || exit 1

# Migration scriptini çalıştır
node migrate-firebase-data.js >> "$LOG_FILE" 2>&1

# Çıkış kodu
EXIT_CODE=$?

echo "" >> "$LOG_FILE"
echo "✅ Migration tamamlandı: $(date)" >> "$LOG_FILE"
echo "📊 Çıkış kodu: $EXIT_CODE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $EXIT_CODE
