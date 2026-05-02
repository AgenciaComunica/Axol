import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
const base = process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/';
// https://vite.dev/config/
export default defineConfig({
    base,
    plugins: [
        vue(),
    ],
    server: {
        port: 5174,
        strictPort: true,
        proxy: {
            '/generate-pdf': {
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
            },
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
});
