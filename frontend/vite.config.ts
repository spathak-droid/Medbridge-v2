/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '..',
  envPrefix: ['VITE_', 'FIREBASE_', 'TEST_'],
  server: {
    port: 3000,
    proxy: {
      '/api/patients': 'http://127.0.0.1:8000',
      '/api/coach': 'http://127.0.0.1:8000',
      '/api/alerts': 'http://127.0.0.1:8000',
      '/api/goals': 'http://127.0.0.1:8000',
      '/api/analytics': 'http://127.0.0.1:8000',
      '/api/health': 'http://127.0.0.1:8000',
      '/api/messages': 'http://127.0.0.1:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
