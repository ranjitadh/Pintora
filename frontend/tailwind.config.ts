import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: "#fbf7ef",
        sand: "#efe7d9",
        ink: "#211b16",
        clay: "#d95d39",
        "clay-dark": "#bc4827",
        olive: "#65714c",
        "olive-soft": "#e7e9dd",
        muted: "#7c7166",
        navy: {
          950: "#04141f",
          900: "#062334",
          800: "#0a3041",
          700: "#0f4150",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Lora", "Georgia", "serif"],
        mono: ["Space Mono", "monospace"],
      },
      boxShadow: {
        card: "0 18px 50px -30px rgba(33,27,22,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;