import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SchemaViz — PostgreSQL Schema Designer',
        short_name: 'SchemaViz',
        description: 'Free, in-browser PostgreSQL schema designer. Drag tables, draw foreign keys, export to SQL, Prisma, Drizzle, PNG, or SVG.',
        theme_color: '#060810',
        background_color: '#060810',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        scope: '/',
        start_url: '/',
        categories: ['developer', 'productivity', 'utilities'],
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    // packages/** run their own test suites (own vitest config, own
    // environment — packages/core needs "node", not "happy-dom") via
    // `pnpm -r test`; excluded here to avoid duplicate/wrong-environment
    // runs. The plain 'node_modules/**' pattern only matches the top-level
    // folder, not nested ones like packages/mcp-server/node_modules — use
    // '**/node_modules/**' so published packages that ship *.test.ts
    // source files (e.g. zod) never leak into this run.
    exclude: ['e2e/**', '**/node_modules/**', 'packages/**'],
  },
})
