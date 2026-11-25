import type { Config } from "tailwindcss";

// 上質な文具風。色の実体は globals.css の CSS 変数で定義する。
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
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-deep": "rgb(var(--primary-deep) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        wine: "rgb(var(--wine) / <alpha-value>)",
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
      // 影はごく薄く、下に長く
      boxShadow: {
        card: "0 1px 2px rgb(40 32 16 / 0.05), 0 14px 30px -18px rgb(40 32 16 / 0.28)",
        hard: "0 1px 2px rgb(40 32 16 / 0.05), 0 14px 30px -18px rgb(40 32 16 / 0.28)",
        "hard-sm": "0 1px 2px rgb(40 32 16 / 0.06), 0 6px 14px -10px rgb(40 32 16 / 0.22)",
        "hard-lg": "0 2px 4px rgb(40 32 16 / 0.06), 0 26px 48px -24px rgb(20 50 40 / 0.45)",
        pop: "0 2px 4px rgb(40 32 16 / 0.06), 0 26px 48px -24px rgb(20 50 40 / 0.45)",
        glow: "0 10px 20px -12px rgb(var(--primary) / 0.7)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Meiryo", "sans-serif"],
        display: ["var(--font-latin)", "var(--font-display)", "Hiragino Mincho ProN", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
