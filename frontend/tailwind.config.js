/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          50: '#f2fbf8',
          100: '#ddf5ee',
          200: '#bdebdc',
          300: '#91dcc4',
          400: '#4fc39e',
          500: '#0ea773',
          600: '#0d8c62',
          700: '#117456',
          800: '#115c47',
          900: '#0d4334',
        },
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
