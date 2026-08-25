/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        medical: {
          50: '#E8F0FE',
          100: '#D2E3FC',
          200: '#AECBFA',
          300: '#8AB4F8',
          400: '#669DF6',
          500: '#1A73E8',
          600: '#1967D2',
          700: '#185ABC',
          800: '#174EA6',
          900: '#12397D',
          950: '#0C2653',
        },
        clinical: {
          50: '#FFFFFF',
          100: '#F0F4F9',
          200: '#E3E3E3',
          300: '#C4C7C5',
          400: '#8E918F',
          500: '#444746',
          600: '#333538',
          700: '#282A2C',
          800: '#1E1F20',
          900: '#131314',
          950: '#000000',
        },
        navy: {
          850: '#1E1F20',
          900: '#131314',
          950: '#000000',
        },
        slate: {
          ...colors.slate,
          700: '#333538',
          800: '#1E1F20',
          900: '#131314',
          950: '#000000',
        },
        teal: {
          ...colors.teal,
          50: '#E8F0FE',
          100: '#D2E3FC',
          200: '#AECBFA',
          300: '#A8C7FA',
          400: '#A8C7FA',
          500: '#A8C7FA',
          600: '#1A73E8',
        },
        pulse: {
          red: '#EA4335',
          amber: '#FBBC04',
          emerald: '#34A853',
          cyan: '#1A73E8',
          indigo: '#9333EA',
        }
      },
      fontFamily: {
        sans: ['"Google Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Google Sans Mono"', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-teal': '0 0 25px -5px rgba(26, 115, 232, 0.3)',
        'glow-red': '0 0 25px -5px rgba(234, 67, 53, 0.4)',
        'glow-cyan': '0 0 25px -5px rgba(26, 115, 232, 0.3)',
        'glow-indigo': '0 0 25px -5px rgba(147, 51, 234, 0.35)',
        'card-dark': '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        'card-light': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
