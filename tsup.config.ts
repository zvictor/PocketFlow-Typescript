import type { Options } from 'tsup'

export const tsup: Options = {
  splitting: true,
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  minify: true,
  bundle: true,
  entryPoints: ['pocketflow/index.ts'],
  outDir: 'dist',
}
