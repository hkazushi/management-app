import type { Config } from "tailwindcss";

// ポップな紙もの風。色の実体は globals.css の CSS 変数で定義する。
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-deep": "rgb(var(--primary-deep) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        sun: "rgb(var(--sun) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        pink: "rgb(var(--pink) / <alpha-value>)",
        lilac: "rgb(var(--lilac) / <alpha-value>)",
        sky: "rgb(var(--sky) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
        "3xl": "1.6rem",
      },
      // 影はぼかさず、黒をずらして置く
      boxShadow: {
        card: "4px 4px 0 rgb(var(--ink))",
        hard: "4px 4px 0 rgb(var(--ink))",
        "hard-sm": "2px 2px 0 rgb(var(--ink))",
        "hard-lg": "6px 6px 0 rgb(var(--ink))",
        pop: "6px 6px 0 rgb(var(--ink))",
        glow: "4px 4px 0 rgb(var(--ink))",
      },
      fontFamily: {
        sans: ["var(--font-body)", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Meiryo", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
