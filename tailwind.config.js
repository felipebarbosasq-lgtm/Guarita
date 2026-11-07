/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#FFD400', dark: '#E6BE00', light: '#FFF4B3' },
        ink: { DEFAULT: '#0A0A0A', soft: '#1C1C1C', muted: '#5C5C5C' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
