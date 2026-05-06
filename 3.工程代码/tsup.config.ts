import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  outDir: 'dist/cli',
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: false,
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
})
