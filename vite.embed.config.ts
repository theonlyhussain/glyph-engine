import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't wipe the main app's build
    lib: {
      entry: 'src/embed.ts',
      name: 'GlyphPlayer',
      fileName: 'embed',
      formats: ['iife'], // IIFE so it works directly as a simple <script> tag
    },
    rollupOptions: {
      external: [], 
      output: {
        entryFileNames: 'embed.js',
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
