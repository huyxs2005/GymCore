/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          50: '#fff8eb',
          100: '#ffedd1',
          200: '#fdd89a',
          300: '#fbbf5c',
          400: '#f6ad2d',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        ambient: '0 20px 45px rgba(0, 0, 0, 0.35)',
        'ambient-sm': '0 8px 24px rgba(0, 0, 0, 0.28)',
        glow: '0 0 20px rgba(245, 158, 11, 0.24)',
        'glow-lg': '0 0 40px rgba(245, 158, 11, 0.24)',
      },
    },
  },
  plugins: [],
}
