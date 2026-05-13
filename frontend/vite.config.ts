import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // amazon-cognito-identity-js → buffer expects Node's `global` in the browser
  define: {
    global: 'globalThis',
  },
  plugins: [react()],
  server: {
    // Windows excluded ranges 包含 5141-5340（见 netsh interface ipv4 show excludedportrange），5173/5174 会 EACCES
    port: 4173,
    host: '127.0.0.1',
  },
})
