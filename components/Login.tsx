import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Lock, User as UserIcon, Settings, Eye, EyeOff, Sun, Moon, Users } from 'lucide-react';
import { realtimeDb } from '../firebase';
import { ref, onValue } from 'firebase/database';

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
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);

  // Çevrimiçi kullanıcı sayısını dinle
  useEffect(() => {
    // Eğer realtimeDb tanımlı değilse, sessizce çık
    if (!realtimeDb) {
      console.warn('⚠️ Realtime Database not initialized');
      return;
    }

    try {
      const presenceRef = ref(realtimeDb, 'presence');

      const unsubscribe = onValue(
        presenceRef,
        (snapshot) => {
          try {
            if (snapshot.exists()) {
              const presenceData = snapshot.val();
              // Aktif kullanıcıları say
              const count = Object.keys(presenceData).length;
              setOnlineUsersCount(count);
            } else {
              setOnlineUsersCount(0);
            }
          } catch (error) {
            console.error('Error processing presence data:', error);
            setOnlineUsersCount(0);
          }
        },
        (error) => {
          // Hata durumunda sessizce logla, sayfa açılmasını engelleme
          console.warn('⚠️ Presence listener error (non-critical):', (error as any)?.code || error.message);
          setOnlineUsersCount(0);
        }
      );

      return () => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from presence:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up presence listener:', error);
      // Hata olsa bile sayfa açılabilsin
      return;
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Get actual values from form inputs (handles browser autofill)
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const usernameValue = formData.get('username') as string || username;
    const passwordValue = formData.get('password') as string || password;

    const user = users.find(u => u.username === usernameValue && u.password === passwordValue);

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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                name="username"
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
                name="password"
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
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center justify-center gap-1.5">
            <Users size={14} />
            <span>{onlineUsersCount} Çevrimiçi Kullanıcı</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;