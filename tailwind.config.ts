import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        orbitron: ['var(--font-orbitron)', 'sans-serif'],
        russo: ['var(--font-russo)', 'sans-serif'],
        grotesk: ['var(--font-grotesk)', 'sans-serif'],
      },
      colors: {
        'midnight-abyss': '#05060f',
        'space-dark':     '#0B0F19',
        'neon-cyan':      '#00F0FF',
        'neon-violet':    '#9333EA',
        'neon-pink':      '#FF003C',
        'neon-green':     '#39FF14',
      },
      backgroundImage: {
        'glass-violet': 'linear-gradient(135deg, rgba(147,51,234,0.08) 0%, rgba(255,255,255,0.03) 100%)',
        'glass-cyan':   'linear-gradient(135deg, rgba(0,240,255,0.06)  0%, rgba(255,255,255,0.03) 100%)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
