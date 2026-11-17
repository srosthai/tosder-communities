import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  // The Node standalone adapter powers local production, Playwright, and CI.
  // Vercel needs its own adapter so the build emits the Build Output API.
  adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
  env: {
    schema: {
      DATABASE_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      DIRECT_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      NEON_AUTH_BASE_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      NEON_AUTH_COOKIE_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CONTENT_ADMIN_EMAILS: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
