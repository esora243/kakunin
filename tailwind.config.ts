import type { Config } from "tailwindcss";

/**
 * Hugmeid デザイントークン。
 *
 * 原則:
 * - 画面側は生の hex / 任意値 (`top-[110px]` 等) を書かない。ここが唯一の定義元。
 * - brand は数値ランプのみ。別名 (light/dark/primary) は値が重複し grep 検査が効かないため廃止。
 * - 装飾目的で Tailwind 既定の blue/purple/green/indigo/emerald を直接使わない。
 *   意味があるものは semantic (success/warning/danger/info)、分類色は accent ランプを使う。
 * - line (#06C755) は LINE 連携の操作にのみ使う。汎用 CTA には使わない。
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
        sans: ["var(--font-sans)", "'Noto Sans JP'", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#F2F4F8",
          100: "#E5EAF5",
          200: "#B9C2DB",
          300: "#7E8FB8",
          400: "#4E63A0",
          500: "#1E3A8A",
          600: "#1A2F73",
          700: "#11204C",
          800: "#0E1A3D",
          900: "#0A1228",
        },
        // 面の意味を固定する: canvas=ページ地, card=コンテンツ, inset=カード内の沈み面
        surface: {
          canvas: "#F2F4F8",
          card: "#FFFFFF",
          subtle: "#F8FAFD",
          inset: "#F2F4F8",
        },
        success: { 50: "#ECFDF5", 100: "#D1FAE5", 500: "#059669", 700: "#047857" },
        warning: { 50: "#FFFBEB", 100: "#FEF3C7", 500: "#D97706", 700: "#B45309" },
        danger: { 50: "#FEF2F2", 100: "#FEE2E2", 500: "#DC2626", 700: "#B91C1C" },
        info: { 50: "#EFF6FF", 100: "#DBEAFE", 500: "#2563EB", 700: "#1D4ED8" },
        // 分類のための categorical ランプ。意味づけのない装飾には使わない。
        accent: {
          1: { 50: "#FDF2F4", 100: "#FADDE3", 500: "#C2566B", 700: "#8C2E42" },
          2: { 50: "#EFF9F8", 100: "#D3EFEC", 500: "#2E8F86", 700: "#1E6259" },
          3: { 50: "#F2F4F8", 100: "#E5EAF5", 500: "#1E3A8A", 700: "#11204C" },
          4: { 50: "#F6F3FC", 100: "#E6DDF7", 500: "#6D4BB8", 700: "#4A2F85" },
          5: { 50: "#FBF6EC", 100: "#F3E6C9", 500: "#A8781F", 700: "#755212" },
        },
        line: { DEFAULT: "#06C755", hover: "#05B34C" },
      },
      // `text-primary` のように読める形にするため colors とは分けて定義する。
      textColor: {
        primary: "#1A1C24",
        secondary: "#4B5563",
        tertiary: "#9CA3AF",
        inverse: "#FFFFFF",
      },
      // 素の `border` もトークン上に乗るよう DEFAULT を subtle に合わせる。
      borderColor: {
        DEFAULT: "#E5EAF5",
        subtle: "#E5EAF5",
        strong: "#B9C2DB",
        bold: "#7E8FB8",
      },
      borderRadius: {
        card: "1rem",
        control: "0.75rem",
        pill: "9999px",
        badge: "0.375rem",
      },
      fontSize: {
        // 日本語UI基準。text-[10px]/[11px]/[9px] の任意値を置き換える。
        micro: ["0.625rem", { lineHeight: "0.875rem" }],
        caption: ["0.6875rem", { lineHeight: "1rem" }],
        meta: ["0.75rem", { lineHeight: "1.125rem" }],
        body: ["0.875rem", { lineHeight: "1.5rem" }],
        lead: ["1rem", { lineHeight: "1.625rem" }],
        h3: ["1rem", { lineHeight: "1.5rem" }],
        h2: ["1.125rem", { lineHeight: "1.625rem" }],
        h1: ["1.5rem", { lineHeight: "2rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,18,40,.06)",
        raised: "0 4px 12px rgba(10,18,40,.08)",
        overlay: "0 12px 32px rgba(10,18,40,.16)",
        bar: "0 -8px 20px rgba(10,18,40,.04)",
      },
      maxWidth: {
        // Container が唯一の参照元。画面側で max-w-lg を書かない。
        app: "32rem",
        content: "48rem",
      },
      spacing: {
        gutter: "1rem",
        section: "1.5rem",
        tap: "2.75rem",
        // 固定 CTA バー / フローティング導線のための安全余白
        "bottom-bar": "calc(7rem + var(--hugmeid-browser-bottom, 0px))",
      },
      inset: {
        // sticky の基準は 1 表現に統一する (top-[10px] / top-[110px] を廃止)
        sticky: "var(--app-sticky-top)",
        "nav-top": "var(--hugmeid-nav-top, 0px)",
        browser: "var(--hugmeid-browser-bottom, 0px)",
        "browser-fab": "calc(6rem + var(--hugmeid-browser-bottom, 0px))",
      },
      minHeight: {
        tap: "2.75rem",
        cell: "4.875rem",
      },
      minWidth: {
        tap: "2.75rem",
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
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-bottom": "slide-in-from-bottom 0.3s ease-out",
        "slide-in-right": "slide-in-from-right 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
