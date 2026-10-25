import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  outDir: './dist',
  platform: 'node',
  format: 'esm',
  outExtensions: () => ({ js: '.mjs' }),
  dts: false,
  clean: true,
})
