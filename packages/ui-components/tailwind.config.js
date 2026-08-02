/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../apps/standalone/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0E0E0E',
        surface: '#171614',
        border: '#262421',
        inputBg: '#171614',
        primaryText: '#EDEDED',
        secondaryText: '#78736B',
        accent: '#D89F3C',
        accentHover: '#ebb24f',
        error: '#E34850',
        success: '#268E6C'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
