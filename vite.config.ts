import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1100, rollupOptions: { output: { manualChunks: (id: string) => id.includes('maplibre-gl') ? 'map' : undefined } } },
})
