import type { Config } from 'tailwindcss';

// Cores vêm de variáveis CSS (app/globals.css) com tema claro/escuro via prefers-color-scheme.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const tone = (name: string) => ({
  DEFAULT: token(name),
  soft: token(`${name}-soft`),
  ink: token(`${name}-ink`),
});

const config: Config = {
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './views/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: token('line'),
        fg: token('fg'),
        muted: token('muted'),
        primary: { DEFAULT: token('primary'), fg: token('primary-fg'), ink: token('primary-ink'), soft: token('primary-soft') },
        success: tone('success'),
        warning: tone('warning'),
        danger: tone('danger'),
        info: tone('info'),
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
        pop: '0 10px 30px rgb(0 0 0 / 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
