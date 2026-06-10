/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        hms: {
          primary: "#4f46e5",
          dark: "#312e81",
        },
      },
    },
  },
  plugins: [],
};
