/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        slate: {
          850: '#172033',
        },
      },
    },
  },
  plugins: [],
}
