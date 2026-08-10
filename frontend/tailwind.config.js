/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',      // blue-600 — buttons, active nav, links
        sidebar: '#0F172A',      // slate-900 — sidebar/header bg
        active: '#1E293B',       // slate-800 — selected sidebar item
        canvas: '#F3F4F6',       // gray-100 — content background
        success: '#059669',      // emerald-600 — confirm, positive
        danger: '#E11D48',       // rose-600 — destructive, errors, logout
        warning: '#D97706',      // amber-600 — caution, pending
        ink: '#111827',          // gray-900 — headings & primary text
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'btn': '6px',      // buttons
        'input': '8px',    // inputs, nav
        'card': '12px',    // cards
        'panel': '16px',   // panels
      },
    },
  },
  plugins: [],
}