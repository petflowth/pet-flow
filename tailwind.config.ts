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
        // สามค่านี้ผูกกับ CSS var เพื่อให้แต่ละร้าน override สีได้ผ่าน <BrandingStyle> —
        // ยังใส่ opacity แบบ bg-honey/30 ได้ตามเดิมเพราะใช้ pattern rgb(var(..) / <alpha-value>)
        honey: {
          DEFAULT: "rgb(var(--honey-rgb) / <alpha-value>)",
          deep: "rgb(var(--honey-deep-rgb) / <alpha-value>)",
        },
        latte: {
          DEFAULT: "rgb(var(--latte-rgb) / <alpha-value>)",
          deep: "rgb(var(--latte-deep-rgb) / <alpha-value>)",
        },
        petflow: {
          yellow: "#f5d76e",
          chocolate: "rgb(var(--chocolate-rgb) / <alpha-value>)",
          line: "#efe6d7",
        },
        sage: "#9fb79a",
        wait: "#d9a05b",
        ok: "#7fa876",
      },
      borderRadius: { petflow: "24px", "petflow-sm": "16px" },
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
