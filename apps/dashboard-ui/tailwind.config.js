/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // breakpoint custom para celulares chicos (iPhone SE = 375px)
        xs: '380px',
      },
      colors: {
        // Paleta Bochile · navy + champagne + blanco (heredada del demo HTML)
        bochile: {
          navy: '#1a2332',        // azul institucional profundo
          'navy-light': '#243349',
          'navy-dark': '#0f1620',
          champagne: '#d4af6e',   // dorado calmo, no estridente
          'champagne-light': '#e8c894',
          'champagne-dark': '#a88654',
          cream: '#f5f1e8',       // crema suave para fondos light
          slate: '#64748b',
        },
        accent: {
          DEFAULT: '#d4af6e',     // champagne como accent principal
          fg: '#1a2332',           // navy oscuro para texto sobre champagne
        },
        // surface usa la paleta navy de Bochile
        surface: {
          0: '#0f1620',           // fondo principal navy más oscuro
          1: '#1a2332',           // bloques (sidebar, cards)
          2: '#243349',           // hover, secundario
          3: '#2d3e57',           // active, terciario
        },
        text: {
          DEFAULT: '#f5f1e8',     // crema sobre navy (alto contraste WCAG AAA)
          muted: '#a8b4c4',        // navegación inactiva
          subtle: '#7a8497',
        },
        border: {
          DEFAULT: '#2d3e57',
          subtle: '#243349',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(212, 175, 110, 0.06) inset, 0 8px 24px rgba(0,0,0,0.5)',
        gold: '0 0 0 1px rgba(212, 175, 110, 0.3), 0 4px 12px rgba(212, 175, 110, 0.15)',
      },
    },
  },
  plugins: [],
};
