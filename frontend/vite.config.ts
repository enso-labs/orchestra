import path from 'path';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA, VitePWAOptions } from 'vite-plugin-pwa'


const MANIFEST: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  devOptions: { enabled: true },
  manifest: {
    name: 'Threadable Chat',
    short_name: 'Threadable Chat',
    description: 'Threadable Chat',
    theme_color: '#000000',
    background_color: '#000000',
    display: 'standalone',
    scope: '/',
    start_url: '.',
    orientation: 'portrait',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA(MANIFEST)
  ],
  build: {
    outDir: '../backend/src/public',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, '')
      },
      '/docs': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/docs/, '')
      }
    }
  }
})