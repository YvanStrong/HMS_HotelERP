/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--color-app-bg)',
          surface: 'var(--color-app-surface)',
          border: 'var(--color-app-border)',
          primary: 'var(--color-app-primary)',
          'primary-soft': 'var(--color-app-primary-soft)',
          success: 'var(--color-app-success)',
          danger: 'var(--color-app-danger)',
          muted: 'var(--color-app-muted)',
          text: 'var(--color-app-text)',
        },
        accent: 'var(--color-app-primary)',
      },
    },
  },
  plugins: [],
};
