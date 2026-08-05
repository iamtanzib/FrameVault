/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: '#141416',
        surfaceHover: '#1C1C1F',
        border: '#232327',
        borderStrong: '#2E2E33',
        inputBg: '#141416',
        primaryText: '#F2F2F3',
        secondaryText: '#8A8A93',
        mutedText: '#5A5A62',
        accent: '#f5a623',
        accentHover: '#fdb73a',
        error: '#E34850',
        success: '#2FA37D'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI Variable', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        glow: '0 0 20px rgba(245, 130, 46, 0.28)',
        'glow-sm': '0 0 12px rgba(245, 130, 46, 0.22)',
        card: '0 8px 30px rgba(0, 0, 0, 0.35)',
        modal: '0 24px 60px rgba(0, 0, 0, 0.55)'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out both',
        'scale-in': 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-down': 'slideDown 0.24s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 1.6s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
