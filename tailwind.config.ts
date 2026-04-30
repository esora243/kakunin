import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff8f4",
          100: "#ffeedf",
          200: "#ffd8b0",
          300: "#ffbd7c",
          400: "#ff9c47",
          500: "#ff7e1b",
          600: "#ea680f",
          700: "#c2540f",
          800: "#9a4514",
          900: "#7c3a14",
        },
      },
      boxShadow: {
        soft: "0 16px 48px rgba(255, 126, 27, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
