import type { Config } from 'tailwindcss';

// Colours are declared with the `<alpha-value>` placeholder (rgb channels in CSS vars), NOT
// as plain `var(--x)` strings: Tailwind silently drops opacity modifiers (bg-brand/20) on
// the latter. HairByRachel shipped ~70 invisible uses of that trap. See globals.css.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-deep': 'rgb(var(--brand-deep) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

export default config;
