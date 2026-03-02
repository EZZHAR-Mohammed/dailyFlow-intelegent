/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#080B14',
          surface: '#0D1120',
          card: '#111827',
          card2: '#161D2E',
          border: '#1E293B',
          border2: '#2D3B52',
        },
        brand: {
          primary: '#6366F1',
          hover: '#4F46E5',
          violet: '#8B5CF6',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'none' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        scoreRing: {
          from: { strokeDashoffset: '301.59' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease',
        slideRight: 'slideRight 0.25s ease',
        spin: 'spin 0.7s linear infinite',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        lg: '0 8px 48px rgba(0,0,0,0.6)',
        glow: '0 4px 16px rgba(99,102,241,0.3)',
      },
    },
  },
  plugins: [],
}
