import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDocsFromCache, onSnapshot } from 'firebase/firestore';
import { Lock, User as UserIcon, Settings, Eye, EyeOff, BookOpen, X, HelpCircle, AlertCircle, CheckCircle, Info, Sun, Moon } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onRefreshUsers?: () => Promise<void>;
  isLoading?: boolean;
}

const Login: React.FC<LoginProps> = ({ users, onLogin, isDarkMode, onToggleTheme, onRefreshUsers, isLoading = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState<'USER' | 'ADMIN'>('USER');
  const [showManual, setShowManual] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isChecking, setIsChecking] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Cache Clear State - Kullanıcı daha önce cache temizlediyse gösterme
  const [showCacheClearButton, setShowCacheClearButton] = useState(() => {
    try {
      return !localStorage.getItem('cache_cleared_v1');
    } catch {
      return true;
    }
  });

  const [onlineCount, setOnlineCount] = useState<number>(0);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    let currentUsers: User[] = [];

    const calculateOnlineCount = () => {
      const now = Date.now();
      // Son 2 dakika içinde active olanları online kabul et
      const count = currentUsers.filter(u => u.lastActive && (now - u.lastActive < 2 * 60 * 1000)).length;
      setOnlineCount(count);
    };

    const unsubscribe = onSnapshot(q, (snapshot) => {
      currentUsers = snapshot.docs.map(doc => doc.data() as User);
      calculateOnlineCount();
    }, (err) => {
      console.warn("Canlı kullanıcı bilgisi alınamadı", err);
    });

    const interval = setInterval(calculateOnlineCount, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsChecking(true);

    console.log('🔐 Login attempt:', {
      username,
      loginType
    });

    try {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      // 1. Try to find user in the already loaded list (fastest)
      let user = users.find(u =>
        String(u.username).trim() === cleanUsername &&
        String(u.password).trim() === cleanPassword
      );

      /* Fallback query removed for speed optimization - users are already live-synced */
      if (!user && users.length === 0 && !isLoading) {
        // Only query if local list is empty and not loading (rare edge case)
        console.log('⚠️ Local user list empty, trying direct query...');
        const q = query(collection(db, 'users'), where('username', '==', cleanUsername), where('password', '==', cleanPassword));
        // Önce cache'den dene
        let snapshot;
        try {
          snapshot = await getDocsFromCache(q);
        } catch {
          snapshot = await getDocs(q);
        }
        if (!snapshot.empty) {
          user = snapshot.docs[0].data() as User;
        }
      }

      if (user) {
        if (loginType === 'ADMIN' && !user.roles.includes(UserRole.ADMIN)) {
          console.log('❌ Admin access denied for user:', user.username);
          setError('Bu hesaba yönetici girişi yetkisi verilmemiştir.');
          return;
        }
        onLogin(user);
      } else {
        console.log('❌ Login failed - user not found');
        setError('Kullanıcı adı veya şifre hatalı.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Giriş sırasında bir hata oluştu.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleTabChange = (type: 'USER' | 'ADMIN') => {
    // Just switch the view, do not auto-login.
    setLoginType(type);
    setError('');
  };

  const handleRefresh = async () => {
    if (!onRefreshUsers) return;

    setIsRefreshing(true);
    setError('');

    try {
      localStorage.removeItem('geds_users_cache');
      localStorage.removeItem('geds_users_cache_timestamp');

      await onRefreshUsers();

      setError('');
      console.log('✅ Kullanıcılar yenilendi:', users.length);
    } catch (error) {
      console.error('❌ Kullanıcılar yenilenemedi:', error);
      setError('Kullanıcılar yüklenirken hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Çerez Temizleme Fonksiyonları
  const handleClearCookies = () => {
    setShowClearConfirm(true);
  };

  const executeClearCookies = () => {
    try {
      // Çerezleri temizle
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Cache temizlendi işaretini koy (bu kalmalı - uyarıyı gizlemek için)
      localStorage.setItem('cache_cleared_v1', 'true');

      // Butonu gizle
      setShowCacheClearButton(false);
      setShowClearConfirm(false);

      // Kullanıcıya bilgi ver ve sayfayı yenile
      setTimeout(() => {
        alert('✅ Çerezler başarıyla silindi!\n\nSayfa yenilenecek...');
        window.location.reload();
      }, 100);

    } catch (error) {
      console.error('Çerez temizleme hatası:', error);
      alert('❌ Çerezler silinirken bir hata oluştu. Lütfen tarayıcınızın ayarlarından manuel olarak silin.');
      setShowClearConfirm(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-200">

      {/* Theme Toggle Button */}
      <button
        onClick={onToggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow-md text-gray-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700 relative transition-colors duration-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Geçici Etkinlik Denetim Sistemi</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Giriş yapmak için bilgilerinizi girin</p>
        </div>

        {/* Fixed Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            type="button"
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${loginType === 'USER'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            onClick={() => handleTabChange('USER')}
          >
            Kullanıcı Girişi
          </button>
          <button
            type="button"
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${loginType === 'ADMIN'
              ? 'text-secondary-600 dark:text-secondary-400 border-b-2 border-secondary-600 dark:border-secondary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            onClick={() => handleTabChange('ADMIN')}
          >
            Yönetici Girişi
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Çerez Temizleme Uyarısı */}
          {showCacheClearButton && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                  <p className="font-bold text-orange-800 dark:text-orange-300 mb-1">Çerez Temizliği Gerekli</p>
                  <p className="text-orange-700 dark:text-orange-400 text-xs">
                    Sistem güncellemesi nedeniyle, giriş yapmadan önce çerezlerinizi silmeniz gerekmektedir.
                    Lütfen aşağıdaki "Çerezleri Sil" butonuna tıklayın.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={showCacheClearButton}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Kullanıcı adınızı girin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Şifre</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={showCacheClearButton}
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Şifrenizi girin"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={showCacheClearButton}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          {loginType === 'USER' ? (
            <button
              type="submit"
              disabled={isChecking || showCacheClearButton}
              className={`w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 ${(isChecking || showCacheClearButton) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isChecking ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Giriş Yapılıyor...
                </>
              ) : (
                <>
                  <UserIcon size={20} />
                  Kullanıcı Girişi Yap
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={isChecking || showCacheClearButton}
              className={`w-full bg-secondary-600 hover:bg-secondary-500 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2 ${(isChecking || showCacheClearButton) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isChecking ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Giriş Yapılıyor...
                </>
              ) : (
                <>
                  <Settings size={20} />
                  Yönetici Girişi Yap
                </>
              )}
            </button>
          )}
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="text-xs text-green-600 dark:text-green-400 font-medium flex-col flex items-center justify-center gap-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Sistem Çevrimiçi {onlineCount > 0 && `(${onlineCount} Kullanıcı Aktif)`}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle size={14} />
            Yardım ve Kullanım Kılavuzu
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? '🔄 Yenileniyor...' : '❓ Giriş yapamıyor musunuz? Tıklayın'}
          </button>

          {showCacheClearButton && (
            <button
              type="button"
              onClick={handleClearCookies}
              className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline font-medium flex items-center gap-1.5 transition-colors"
            >
              🗑️ Çerezleri Sil (Sorun Yaşıyorsanız)
            </button>
          )}
        </div>
      </div>

      {/* Clear Cookies Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full shrink-0">
                <AlertCircle className="text-orange-600 dark:text-orange-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Çerezler Silinsin mi?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Giriş sorunlarını gidermek için çerezler silinecek ve sayfa yenilenecektir. Devam etmek istiyor musunuz?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={executeClearCookies}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow-md"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}


      {/* User Manual Modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg text-primary-600 dark:text-primary-400">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Kullanım Kılavuzu</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Geçici Etkinlik Denetim Sistemi</p>
                </div>
              </div>
              <button
                onClick={() => setShowManual(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 prose prose-blue dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs">1</span>
                  Amaç ve Kapsam
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">
                  <p>
                    <strong>Amaç:</strong> Bu sistemin amacı, geçici etkinliklerde görev alacak personelin kimlik doğrulamalarını yapmak, belirlenen kotaları takip etmek ve aynı personelin çakışan saatlerde farklı etkinliklerde görev almasını (mükerrer kayıt) engellemektir.
                  </p>
                  <p>
                    <strong>Kapsam:</strong> Bu kılavuz; sisteme giriş, etkinlik yönetimi, kimlik sorgulama ekranları, veritabanı entegrasyonu ve raporlama süreçlerinin tamamını kapsar.
                  </p>
                </div>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">2</span>
                  Giriş İşlemleri
                </h3>
                <p className="mb-4 text-sm">Sisteme yetki seviyenize göre iki farklı giriş yöntemiyle erişebilirsiniz:</p>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl">
                    <h4 className="font-bold text-primary-700 dark:text-primary-400 mb-2 text-sm">Kullanıcı Girişi</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Saha personeli için tasarlanmıştır. Sadece denetim başlatabilir ve kimlik okutabilir.</p>
                  </div>
                  <div className="border border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl">
                    <h4 className="font-bold text-secondary-700 dark:text-secondary-400 mb-2 text-sm">Yönetici Girişi</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Sistem yöneticileri içindir. Etkinlik oluşturma, kullanıcı yönetimi ve raporlama yetkisi vardır.</p>
                  </div>
                </div>
              </section>

              <div className="grid md:grid-cols-2 gap-8 mb-10">
                <section>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs">3</span>
                    Yönetici Kılavuzu
                  </h3>
                  <ul className="space-y-3 text-sm list-none pl-0">
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-purple-400"></div>
                      <span><strong>Ana Panel:</strong> Aktif, Devam Eden ve Pasif etkinliklerinizi buradan takip edebilirsiniz.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-purple-400"></div>
                      <span><strong>Etkinlik Yönetimi:</strong> Yeni etkinlik ekleyebilir, silebilir veya pasif etkinlikleri tekrar aktif hale getirebilirsiniz.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-purple-400"></div>
                      <span><strong>Excel Yükle:</strong> Denetim ekranında toplu TC listesi yükleyerek hızlı kayıt yapabilirsiniz.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-purple-400"></div>
                      <span><strong>Kullanıcılar:</strong> "Kullanıcılar" sekmesinden yeni personel ekleyebilir, yetki değiştirebilir veya şifre sıfırlayabilirsiniz.</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">4</span>
                    Kullanıcı Kılavuzu
                  </h3>
                  <ul className="space-y-3 text-sm list-none pl-0">
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-blue-400"></div>
                      <span><strong>Denetim Başlat:</strong> Atandığınız etkinliği seçerek "Denetimi Başlat" butonuna basın.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-blue-400"></div>
                      <span><strong>TC Okutma:</strong> Kimlik numarasını girin. Sistem otomatik olarak veritabanı, çakışma ve kota kontrolü yapar.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="mt-1 min-w-[5px] h-[5px] rounded-full bg-blue-400"></div>
                      <span><strong>Denetimi Bitir:</strong> Hedef sayıya ulaşıldığında buton aktif olur. Basıldığında liste Excel olarak iner ve etkinlik kapanır.</span>
                    </li>
                  </ul>
                </section>
              </div>

              <section className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-xl border border-orange-100 dark:border-orange-900/30">
                <h3 className="text-lg font-bold text-orange-800 dark:text-orange-300 mb-4 flex items-center gap-2">
                  <Info size={20} />
                  Önemli Bilgilendirmeler
                </h3>
                <div className="grid gap-4 text-sm">
                  <div className="flex gap-3">
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <p><strong>Veritabanı Kontrolü:</strong> Yeşil renk, kişinin veritabanında olduğunu ve geçerli olduğunu gösterir. Kırmızı renk ve uyarı mesajı, kişinin bulunamadığını veya süresinin dolduğunu belirtir.</p>
                  </div>
                  <div className="flex gap-3">
                    <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <p><strong>Çakışma Kontrolü:</strong> Bir kişi aynı anda sadece bir aktif etkinlikte bulunabilir. Çakışma durumunda sistem, hangi etkinlikte ve saat aralığında görevli olduğunu size bildirir.</p>
                  </div>
                  <div className="flex gap-3">
                    <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p><strong>Canlı Senkronizasyon:</strong> Sistem internet üzerinden çalışır. Bir bilgisayarda yapılan okutma işlemi, diğer bilgisayarlarda anlık olarak güncellenir.</p>
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setShowManual(false)}
                className="px-6 py-2.5 bg-gray-900 dark:bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                Anlaşıldı, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;