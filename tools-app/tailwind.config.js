import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          50: 'hsl(var(--primary-50))',
          100: 'hsl(var(--primary-100))',
          300: 'hsl(var(--primary-300))',
          500: 'hsl(var(--primary))',
          600: 'hsl(var(--primary-600))',
          700: 'hsl(var(--primary-700))',
          900: 'hsl(var(--primary-900))',
        },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        info: 'hsl(var(--info))',
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        scrollbar: 'hsl(var(--scrollbar))',
        // live-parity surface aliases (globals.css §2)
        'surface-panel': 'hsl(var(--surface-panel))',
        'surface-accent': 'hsl(var(--surface-accent))',
        'surface-raised': 'hsl(var(--surface-raised))',
        'surface-input': 'hsl(var(--surface-input))',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        lime: 'hsl(var(--primary))',
      },
      // .pen radius scale — 2 / 8 / 12 / 999
      borderRadius: {
        xs: '2px',
        sm: '8px',
        md: '12px',
        lg: '12px',
        full: '999px',
      },
      // ponytail: kept Geist over Inter — index.html already loads Geist + Geist Mono.
      // Swapping fonts would mean a new <link> and a visual regression for no gain.
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'progress-indeterminate': { '0%': { left: '-33%' }, '100%': { left: '100%' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
        'progress-indeterminate': 'progress-indeterminate 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
}
