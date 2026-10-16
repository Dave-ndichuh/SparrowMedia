import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        studio: {
          950: "#090A0F",
          900: "#0F111A",
          850: "#141724",
          800: "#1A1E2E",
          700: "#262C42",
          600: "#363E5D",
          500: "#505C87",
        },
        tally: {
          red: "#EF4444",
          green: "#10B981",
          amber: "#F59E0B",
          blue: "#3B82F6",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
