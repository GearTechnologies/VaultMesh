import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          500: "#6366f1",
          600: "#4f46e5",
          900: "#1e1b4b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
