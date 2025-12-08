/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Mevcut kodunuzdaki renk sınıflarını (primary-600 vb.) desteklemek için
        primary: colors.blue,
        secondary: colors.purple,
        gray: colors.slate,
      }
    },
  },
  plugins: [],
}