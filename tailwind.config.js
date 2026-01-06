/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        elf: {
          light: '#a7f3d0',
          DEFAULT: '#10b981',
          dark: '#065f46',
        },
        goblin: {
          light: '#fde68a',
          DEFAULT: '#f59e0b',
          dark: '#92400e',
        },
        human: {
          light: '#bfdbfe',
          DEFAULT: '#3b82f6',
          dark: '#1e40af',
        },
        demon: {
          light: '#fca5a5',
          DEFAULT: '#ef4444',
          dark: '#991b1b',
        },
      },
      fontFamily: {
        game: ['Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
