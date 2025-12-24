/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        casper: {
          red: '#FF0011',
          dark: '#0A0A0A',
          gray: '#1A1A1A',
        },
        ethereum: {
          purple: '#627EEA',
          dark: '#1B1B1B',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
