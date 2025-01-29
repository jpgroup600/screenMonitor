/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}", // ✅ Watches all React & Electron files
    "./public/index.html"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
