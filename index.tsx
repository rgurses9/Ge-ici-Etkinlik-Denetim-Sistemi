import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';


// TanStack Query Client Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 24 * 60 * 60 * 1000, // 24 saat - veriler 24 saat boyunca fresh kabul edilir
      gcTime: 48 * 60 * 60 * 1000, // 48 saat - cache'te tutulma süresi (eski adı: cacheTime)
      refetchOnWindowFocus: false, // Pencere odaklandığında otomatik refetch yapma
      refetchOnReconnect: true, // İnternet bağlantısı geri geldiğinde refetch yap
      retry: 1, // Hata durumunda 1 kez tekrar dene
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