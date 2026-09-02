import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Hugmeid admin palette roles:
      // canvas #F2F4F8 / line #B9C2DB / action #1E3A8A /
      // action-dark #11204C / ink #1A1C24
      colors: {
        stone: {
          50: "#F2F4F8",
          100: "#F2F4F8",
          200: "#B9C2DB",
          300: "#B9C2DB",
          400: "#1E3A8A",
          500: "#1E3A8A",
          600: "#11204C",
          700: "#11204C",
          800: "#1A1C24",
          900: "#1A1C24",
        },
        orange: {
          50: "#F2F4F8",
          100: "#F2F4F8",
          200: "#B9C2DB",
          300: "#B9C2DB",
          400: "#1E3A8A",
          500: "#1E3A8A",
          600: "#1E3A8A",
          700: "#11204C",
        },
      },
      fontFamily: {
        sans: ["'Noto Sans JP'", "'Inter'", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
