import type { Config } from "tailwindcss";

// Tailwind v4 - theme configuration is now in CSS using @theme
// This config file is minimal and primarily for content paths
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
} satisfies Config;
