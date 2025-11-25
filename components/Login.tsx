
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Lock, User as UserIcon, Settings, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState<'USER' | 'ADMIN'>('USER');

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Geçici Etkinlik Denetim Sistemi</h1>
          <p className="text-gray-500 text-sm">Giriş yapmak için bilgilerinizi girin</p>
        </div>

        {/* Fixed Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
              loginType === 'USER' 
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange('USER')}
          >
            Kullanıcı Girişi
          </button>
          <button
             type="button"
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
              loginType === 'ADMIN' 
                ? 'text-secondary-600 border-b-2 border-secondary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange('ADMIN')}
          >
            Yönetici Girişi
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 text-gray-900"
                placeholder="Kullanıcı adınızı girin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 text-gray-900"
                placeholder="Şifrenizi girin"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
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

        <div className="mt-8 text-center text-xs text-green-600 font-medium flex items-center justify-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          Sistem Çevrimiçi
        </div>
      </div>
    </div>
  );
};

export default Login;
