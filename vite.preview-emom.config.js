// Config sólo para armar el banco de pruebas del EMOM (preview-emom.html). No toca el build
// de la app: sale a dist-preview/ y no se deploya a ningún lado.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    outDir: 'dist-preview',
    rollupOptions: {
      input: resolve(process.cwd(), 'preview-emom.html'),
    },
  },
})
