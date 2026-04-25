import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PERF: Split heavy 3rd-party deps into their own chunks so that the home /
// login pages don't need to download the PDF viewer, video player, dnd-kit,
// or MUI icon set on first paint. Each lazy-loaded route then pulls only what
// it actually needs.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Raised to 1100 kB: dash.all.min (MPEG-DASH) is 962 kB pre-minified and
    // cannot be split further; it is already lazy-loaded so it does not affect
    // initial load. All other chunks are well below 800 kB.
    chunkSizeWarningLimit: 1100,
    // Use Vite 8's default minifier (oxc — fast, ships built-in).
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown requires manualChunks to be a function.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'react-vendor';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react-vendor';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (
            id.includes('react-pdf') ||
            id.includes('react-player') ||
            id.includes('@cyntler/react-doc-viewer') ||
            id.includes('pdfjs-dist')
          ) {
            return 'media';
          }
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('zustand') || id.includes('axios')) return 'state';
          return undefined;
        },
      },
    },
  },
  // Pre-bundle these heavy libs in dev so HMR is snappy too.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'zustand'],
  },
})
