import { defineConfig } from 'vite';
import { resolve } from 'path';

const isLibBuild = process.env.BUILD_LIB === 'true';

export default defineConfig(
  isLibBuild
    ? {
        build: {
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'DashContractFeeEstimator',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
          },
          outDir: 'dist-lib',
          target: 'es2020',
          sourcemap: true,
        },
      }
    : {
        base: process.env.BASE_PATH || '/',
        build: {
          outDir: 'dist',
          target: 'es2020',
        },
      },
);
