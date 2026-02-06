import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // @google/genai SDK'sının process.env.API_KEY beklentisini karşılamak için
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      // Diğer kütüphanelerin process.env erişiminde çökmesini engellemek için boş obje tanımlıyoruz
      'process.env': {},
    },
  };
});