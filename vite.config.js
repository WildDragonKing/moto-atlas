import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// base: muss bei GitHub Pages der Repo-Name sein
// (= '/moto-atlas/' produktiv, '/' lokal).
// Kann via VITE_BASE env-var override werden.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [svelte()],
  publicDir: 'public',
  server: {
    port: 5173,
    fs: {
      // catalog.json + routes/* liegen ausserhalb von public/ —
      // Vite Dev-Server muss die Schwester-Ordner auch serven.
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
