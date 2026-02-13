/**
 * LocalStorage cache'ini temizleyen basit script
 * Tarayıcı console'unda çalıştırın:
 * 
 * localStorage.removeItem('geds_scanned_entries_cache');
 * localStorage.removeItem('geds_events_cache');
 * location.reload();
 */

console.log('🧹 Cache temizleniyor...');
localStorage.removeItem('geds_scanned_entries_cache');
localStorage.removeItem('geds_events_cache');
console.log('✅ Cache temizlendi! Sayfa yenileniyor...');
location.reload();
