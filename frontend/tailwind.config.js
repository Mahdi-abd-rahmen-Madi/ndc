/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          dark: '#5a6fd8',
        },
        secondary: {
          DEFAULT: '#764ba2',
        },
        terrain: {
          0: '#0077be',
          II: '#28a745',
          IIIa: '#ffc107',
          IIIb: '#fd7e14',
          IV: '#dc3545',
        },
      },
      animation: {
        'pulse': 'pulse 2s infinite',
        'spin': 'spin 1s linear infinite',
        'highlight-pulse': 'highlightPulse 2s ease-in-out',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
        spin: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        highlightPulse: {
          '0%': { backgroundColor: '#ffeaa7' },
          '50%': { backgroundColor: '#fff3cd' },
          '100%': { backgroundColor: '#fff3cd' },
        },
      },
    },
  },
  plugins: [],
}
