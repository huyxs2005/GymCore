/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          50: '#f2fbf8',
          100: '#ddf5ee',
          500: '#0ea773',
          700: '#117456',
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
