/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: "#05060a",
          800: "#0a0c13",
          700: "#0f1420"
        },
        accent: {
          500: "#6dd6ff",
          400: "#9ef2ff"
        }
      }
    }
  },
  plugins: []
};
