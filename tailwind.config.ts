import type { Config } from "tailwindcss";

// warm / vibrant トーン。色の実体は globals.css の CSS 変数で定義する。
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
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
        "3xl": "1.6rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(28 22 18 / 0.04), 0 6px 16px -8px rgb(28 22 18 / 0.10)",
        pop: "0 8px 30px -10px rgb(28 22 18 / 0.18)",
        glow: "0 6px 20px -6px rgb(var(--primary) / 0.45)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Noto Sans JP",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
