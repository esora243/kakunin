import type { Config } from "tailwindcss";

/**
 * Tailwind 設定
 * TestAPP デザインシステムを移植:
 *   - ブランドカラー(navy #11204C / #1E3A8A / #B9C2DB) を colors.brand に登録
 *   - fade-in / slide-in 系アニメーション拡張
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans JP'", "'Inter'", "sans-serif"],
      },
      colors: {
        brand: {
          // HugNavi 主軸ネイビー (TestAPP 準拠)
          50: "#F2F4F8",
          100: "#E5E9F2",
          200: "#B9C2DB",
          400: "#1E3A8A",
          500: "#1E3A8A",
          600: "#17307A",
          700: "#11204C",
          // アクセント (ハイライト)
          accent: "#11204C",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-from-bottom": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-bottom": "slide-in-from-bottom 0.3s ease-out",
        "slide-in-right": "slide-in-from-right 0.3s ease-out",
        "slide-in-top": "slide-in-from-top 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
