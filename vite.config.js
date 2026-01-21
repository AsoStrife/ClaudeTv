import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // vueDevTools(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
    server: {
        proxy: {
            '/api/proxy': {
                target: '',
                changeOrigin: true,
                rewrite: (path) => '',
                configure: (proxy, options) => {
                    proxy.on('proxyReq', (proxyReq, req, res) => {
                        // Ottieni l'URL target dai query params
                        const url = new URL(req.url, `http://${req.headers.host}`)
                        const targetUrl = url.searchParams.get('url')
                        if (targetUrl) {
                            const targetParsed = new URL(targetUrl)
                            proxyReq.path = targetParsed.pathname + targetParsed.search
                            proxyReq.setHeader('host', targetParsed.host)
                            // Cambia dinamicamente il target
                            proxy.options.target = `${targetParsed.protocol}//${targetParsed.host}`
                        }
                    })
                }
            }
        }
    }
})
