/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#f1f5f9',
          surface: '#ffffff',
          border: '#cbd5e1',
          primary: '#1d4ed8',
          'primary-soft': '#dbeafe',
          success: '#047857',
          danger: '#b91c1c',
          muted: '#64748b',
          text: '#0f172a',
        },
        accent: '#1d4ed8',
      },
    },
  },
  plugins: [],
};
