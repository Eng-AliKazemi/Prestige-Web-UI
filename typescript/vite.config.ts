import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(dir, 'src/index.ts'),
            name: 'Prestige',
            fileName: 'prestige',
            formats: ['es', 'umd'],
        },
        outDir: '../dist',
        emptyOutDir: false,
        sourcemap: true,
        minify: 'terser',
    },
});
