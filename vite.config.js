import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          ['styled-jsx/babel', { optimizeForSpeed: true }]
        ]
      }
    })
  ],
  server: {
    host: true, // Allow access from network
    port: 5174,
  },
  build: {
    outDir: 'build', // Make sure it's 'build'
  },
  base: '/', // this is important
})