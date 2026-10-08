import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base: the site is served both from the custom domain root
  // (www.somebodywant3d.com) and the GitHub project page (/DOME/), so asset
  // URLs must resolve from index.html's own location in either case.
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 900
  },
  server: {
    port: 8150,
    open: false
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    deps: {
      inline: ['react', 'react-dom', '@testing-library/react']
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@testing-library/react']
    }
  }
})
