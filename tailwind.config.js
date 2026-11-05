/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand primary — a refined slate-blue
        primary: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c1d3ff",
          300: "#93b4ff",
          400: "#6491ff",
          500: "#3b6eff",   // main brand color
          600: "#2454f0",
          700: "#1a3fcc",
          800: "#1633a3",
          900: "#162d82",
        },
        // Sidebar background
        sidebar: {
          bg:      "#1e2a3a",
          hover:   "#273548",
          active:  "#2e4060",
          text:    "#a9bcd4",
          heading: "#647a96",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
