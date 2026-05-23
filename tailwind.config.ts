import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'space-dark': '#0B0F19',
        'neon-cyan': '#00F0FF',
        'neon-pink': '#FF003C',
        'neon-green': '#39FF14',
      },
    },
  },
  plugins: [],
};
export default config;
