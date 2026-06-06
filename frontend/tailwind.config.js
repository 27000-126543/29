/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0a2540',
        accent: '#1abc9c',
        gold: '#f1c40f',
        danger: '#e74c3c',
        info: '#3498db',
      },
      fontFamily: {
        display: ['"Comic Sans MS"', '"Noto Sans SC"', 'sans-serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
