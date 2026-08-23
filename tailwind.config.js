/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#DD004A',
          700: '#a30039',
        },
        vega: {
          blue: '#001837',
          red: '#DD004A',
          pink: '#FF87AC',
        },
        grayscale: {
          200: '#e6e6e6',
          400: '#c4c4c4',
          700: '#2b2b2b',
          800: '#1a1a1a',
          900: '#000',
        },
      },
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
