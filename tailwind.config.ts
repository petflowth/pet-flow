import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#fbf6ef",
        paper: "#f4ece0",
        card: "#fffdfa",
        brown: { DEFAULT: "#4e3e32", soft: "#a2907e", faint: "#c4b4a2" },
        honey: { DEFAULT: "#ebc583", deep: "#e0ad5a" },
        latte: { DEFAULT: "#c7a583", deep: "#a9855f" },
        catcha: { yellow: "#f5d76e", chocolate: "#5c4033", line: "#efe6d7" },
        sage: "#9fb79a",
        wait: "#d9a05b",
        ok: "#7fa876",
      },
      borderRadius: { catcha: "24px", "catcha-sm": "16px" },
      fontFamily: {
        sans: [
          "Sukhumvit Set",
          "-apple-system",
          "Leelawadee UI",
          "Noto Sans Thai",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
