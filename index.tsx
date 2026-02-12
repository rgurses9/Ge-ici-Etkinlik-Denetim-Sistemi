import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// TanStack Query Client yapılandırması
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Varsayılan ayarlar - her query için özelleştirilebilir
      staleTime: 5 * 60 * 1000, // 5 dakika (varsayılan)
      gcTime: 10 * 60 * 1000, // 10 dakika (eski adı: cacheTime)
      retry: 1, // Başarısız istekleri 1 kez tekrar dene
      refetchOnWindowFocus: false, // Pencere odaklandığında otomatik yenileme yapma
      refetchOnReconnect: true, // İnternet bağlantısı geri geldiğinde yenile
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);