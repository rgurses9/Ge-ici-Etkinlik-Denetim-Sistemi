import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Lock, User as UserIcon, Settings, Eye, EyeOff, BookOpen, X, HelpCircle, AlertCircle, CheckCircle, Info, Sun, Moon } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin, isDarkMode, onToggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState<'USER' | 'ADMIN'>('USER');
  const [showManual, setShowManual] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      if (loginType === 'ADMIN' && !user.roles.includes(UserRole.ADMIN)) {
        setError('Bu hesaba yönetici girişi yetkisi verilmemiştir.');
        return;
      }
      onLogin(user);
    } else {
      setError('Kullanıcı adı veya şifre hatalı.');
    }
  };

  const handleTabChange = (type: 'USER' | 'ADMIN') => {
    // Just switch the view, do not auto-login.
    setLoginType(type);
    setError('');
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
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
              loginType === 'USER' 
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={() => handleTabChange('USER')}
          >
            Kullanıcı Girişi
          </button>
          <button
             type="button"
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
              loginType === 'ADMIN' 
                ? 'text-secondary-600 dark:text-secondary-400 border-b-2 border-secondary-600 dark:border-secondary-400' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            onClick={() => handleTabChange('ADMIN')}
          >
            Yönetici Girişi
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
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
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
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
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                placeholder="Şifrenizi girin"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2"
            >
              <UserIcon size={20} />
              Kullanıcı Girişi Yap
            </button>
          ) : (
             <button
              type="submit"
              className="w-full bg-secondary-600 hover:bg-secondary-500 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2"
            >
              <Settings size={20} />
              Yönetici Girişi Yap
            </button>
          )}
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Sistem Çevrimiçi
          </div>
          
          <button 
            type="button"
            onClick={() => setShowManual(true)}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle size={14} />
            Yardım ve Kullanım Kılavuzu
          </button>
        </div>
      </div>

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