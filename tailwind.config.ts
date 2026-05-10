import type { Config } from "tailwindcss";

/**
 * Tailwind 設定
 * - Hugmeid mock デザインシステム反映:
 *   - ブランドカラー(orange/rose) を colors.brand に登録
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
          // Hugmeid 主軸オレンジ
          50: "#FFF9FA",
          100: "#FFEDD5",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          // Hugmeid ロゴで使われる rose アクセント
          accent: "#FB7185",
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
