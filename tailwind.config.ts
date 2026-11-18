import type { Config } from "tailwindcss";

// Design tokens (documented in docs/DESIGN_SYSTEM.md). Change colours here, not in components.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#0F1F3D", 800: "#1A2E55", 300: "#C9D3E6" },
        brand: { DEFAULT: "#2557D6", 50: "#EEF3FF", 100: "#DCE7FF", 700: "#1B3FA0" },
        line: "#E3E7EF",
        canvas: "#F4F6FA",
        ink: { DEFAULT: "#14213D", muted: "#5B6577" },
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      borderRadius: { card: "12px" },
    },
  },
  plugins: [],
};
export default config;
