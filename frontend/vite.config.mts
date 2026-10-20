import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { type Plugin, defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

// import { toolbarDenylistPlugin } from './vite-toolbar-plugin'
import { htmlGenerationPlugin } from './plugins/vite-html-plugin'
import { posthogJsPlugin } from './plugins/vite-posthog-js-plugin'
import { publicAssetsPlugin } from './plugins/vite-public-assets-plugin'

// Bundled dev's own watcher misses source edits in this setup, and it only regenerates stale output
// when Vite serves the HTML page, which Django does here. Rebuild from Vite's watcher instead, so
// an edit reaches open previews without restarting the frontend.
function bundledDevRebuildOnChangePlugin(): Plugin {
    return {
        name: 'bundled-dev-rebuild-on-change',
        apply: 'serve',
        configureServer(server) {
            const sourceRoots = [
                resolve(__dirname, 'src'),
                resolve(__dirname, '../products'),
                resolve(__dirname, '../common'),
            ]
            server.watcher.add(sourceRoots)
            let timer: ReturnType<typeof setTimeout> | undefined
            const rebuild = async (): Promise<void> => {
                const started = Date.now()
                // devEngine is private on BundledDev; it is the only handle that can force a rebuild.
                const devEngine = (
                    server.environments.client.bundledDev as unknown as
                        | { devEngine?: { triggerFullBuild(): void; ensureLatestBuildOutput(): Promise<void> } }
                        | undefined
                )?.devEngine
                if (!devEngine) {
                    return
                }
                devEngine.triggerFullBuild()
                await devEngine.ensureLatestBuildOutput()
                server.environments.client.hot.send({ type: 'full-reload', path: '*' })
                server.config.logger.info(`bundled dev rebuilt after a source change in ${Date.now() - started}ms`, {
                    timestamp: true,
                })
            }
            const onSourceChange = (file: string): void => {
                // products/ and common/ also hold backend code, which the frontend bundle never imports.
                if (!/\.(tsx?|jsx?|mjs|s?css|json)$/.test(file) || !sourceRoots.some((root) => file.startsWith(root))) {
                    return
                }
                clearTimeout(timer)
                timer = setTimeout(() => void rebuild().catch((e) => server.config.logger.error(String(e))), 200)
            }
            server.watcher.on('change', onSourceChange)
            server.watcher.on('add', onSourceChange)
            server.watcher.on('unlink', onSourceChange)
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isDev = mode === 'development'
    const useBundledDev = process.env.VITE_BUNDLED_DEV === '1'

    return {
        plugins: [
            react(),
            tailwindcss(),
            // We delete and copy the HTML files for development
            htmlGenerationPlugin(),
            // Copy public assets to src/assets for development
            publicAssetsPlugin(),
            // Copy posthog-js files from node_modules to dist for development
            posthogJsPlugin(),
            {
                name: 'startup-message',
                configureServer(server) {
                    server.httpServer?.once('listening', () => {
                        setTimeout(() => {
                            console.info(`
――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――

   🚀 Visit http://localhost:8010 to see the app
   ⚠️  You may need to wait for the other services to start

――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
`)
                        }, 1000)
                    })
                },
            },
            ...(useBundledDev ? [bundledDevRebuildOnChangePlugin()] : []),
        ],
        resolve: {
            dedupe: ['@base-ui/react'],
            alias: {
                '@base-ui/react': resolve(__dirname, 'node_modules/@base-ui/react'),
                '~': fileURLToPath(new URL('./src', import.meta.url)),
                '@': fileURLToPath(new URL('./src', import.meta.url)),
                // Add direct mappings for PostHog's import structure from tsconfig.json
                lib: resolve(__dirname, 'src/lib'),
                scenes: resolve(__dirname, 'src/scenes'),
                queries: resolve(__dirname, 'src/queries'),
                layout: resolve(__dirname, 'src/layout'),
                toolbar: resolve(__dirname, 'src/toolbar'),
                taxonomy: resolve(__dirname, 'src/taxonomy'),
                models: resolve(__dirname, 'src/models'),
                mocks: resolve(__dirname, 'src/mocks'),
                exporter: resolve(__dirname, 'src/exporter'),
                types: resolve(__dirname, 'src/types.ts'),
                // @posthog/lemon-ui aliases
                '@posthog/lemon-ui': resolve(__dirname, '@posthog/lemon-ui/src/index'),
                '@posthog/lemon-ui/': resolve(__dirname, '@posthog/lemon-ui/src/'),
                // Other aliases from tsconfig.json
                storybook: resolve(__dirname, '../.storybook'),
                // Just for Vite: we copy public assets to src/assets, we need to alias it to the correct path
                public: resolve(__dirname, 'src/assets'),
                // Required for production builds — @posthog/icons is in the pnpm store, not node_modules root
                '@posthog/icons': resolve(__dirname, 'node_modules/@posthog/icons'),
                // Source-only workspace package (exports map points at src/*.ts) — Vite can't resolve
                // it by default when imported from products/*/frontend, like the @posthog/icons case above.
                // Alias each export explicitly, subpath first: a lone package-root alias would rewrite the
                // '@posthog/llm-normalizer/types' import to a nonexistent path instead of src/types.ts.
                '@posthog/llm-normalizer/types': resolve(
                    __dirname,
                    'node_modules/@posthog/llm-normalizer/src/types.ts'
                ),
                '@posthog/llm-normalizer': resolve(__dirname, 'node_modules/@posthog/llm-normalizer/src/index.ts'),
                // These @tiptap packages live only in frontend/node_modules, which products/*/frontend
                // files can't reach by walking up from their own directory. Alias each package
                // individually: a blanket '@tiptap' prefix would also rewrite the imports *inside*
                // tiptap packages (e.g. starter-kit importing @tiptap/extension-code) to paths that
                // don't exist under frontend/node_modules.
                '@tiptap/core': resolve(__dirname, 'node_modules/@tiptap/core'),
                '@tiptap/react': resolve(__dirname, 'node_modules/@tiptap/react'),
                '@tiptap/pm': resolve(__dirname, 'node_modules/@tiptap/pm'),
                '@tiptap/extension-placeholder': resolve(__dirname, 'node_modules/@tiptap/extension-placeholder'),
                products: resolve(__dirname, '../products'),
                '@posthog/shared-onboarding': resolve(__dirname, '../docs/onboarding'),
                '@posthog/shared-onboarding/*': resolve(__dirname, '../docs/onboarding/*'),
                // Node.js polyfills for browser compatibility
                buffer: 'buffer',
            },
        },
        build: {
            // Generate manifest for backend integration
            manifest: true,
            outDir: 'dist',
            rollupOptions: {
                // Eager output keeps the first preview viewer from becoming the bundled-dev compiler.
                ...(useBundledDev ? { experimental: { devMode: { lazy: false } } } : {}),
                input: {
                    index: resolve(__dirname, 'src/index.tsx'),
                    exporter: resolve(__dirname, 'src/exporter/index.tsx'),
                    render_query: resolve(__dirname, 'src/render-query/index.tsx'),
                    toolbar: resolve(__dirname, 'src/toolbar/index.tsx'),
                    ...(useBundledDev ? { react_refresh: resolve(__dirname, 'react-refresh-entry.mjs') } : {}),
                },
                output: {
                    entryFileNames: isDev ? '[name].js' : '[name]-[hash].js',
                    chunkFileNames: isDev ? 'chunk-[name].js' : 'chunk-[name]-[hash].js',
                    assetFileNames: isDev ? '~/assets/[name].[ext]' : '~/assets/[name]-[hash].[ext]',
                },
            },
            sourcemap: true,
        },
        experimental: {
            bundledDev: useBundledDev,
        },
        worker: {
            format: 'es', // Use ES modules to support WASM imports
            plugins: () => [react()],
            rollupOptions: {
                output: {
                    entryFileNames: isDev ? '[name].js' : '[name]-[hash].js',
                },
            },
        },
        server: {
            port: 8234,
            // The rest of the stack hardcodes 8234, so falling back to another port serves a
            // broken app (the browser keeps talking to whatever squats 8234). Fail loudly instead;
            // bin/start-frontend reclaims the port from stale processes before launching.
            strictPort: true,
            host: process.argv.includes('--host') ? '0.0.0.0' : 'localhost',
            allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            // nosemgrep: trailofbits.javascript.apollo-graphql.v3-cors-audit.v3-potentially-bad-cors
            cors: true,
            // JS_URL overrides for sandbox environments where Vite is exposed on a different port.
            origin: process.env.JS_URL || 'http://localhost:8234',
            hmr: process.env.JS_URL ? { clientPort: parseInt(process.env.JS_URL.split(':').pop()!) } : undefined,
            proxy: {
                '/static': {
                    target: 'http://localhost:8000',
                    changeOrigin: true,
                },
            },
        },
        define: {
            global: 'globalThis',
            'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
        },
        css: {
            devSourcemap: true,
        },
        optimizeDeps: {
            include: ['react', 'react-dom', 'buffer'],
            // snappy-wasm: don't pre-bundle so the WASM file stays with the JS.
            // @posthog/brand: its PNG stubs resolve assets via `new URL(..., import.meta.url)`,
            // which pre-bundling rewrites to .vite/deps/ where the images don't exist — hoggie
            // art silently 404s in dev serve (production builds are unaffected).
            exclude: ['snappy-wasm', '@posthog/brand'],
        },
    }
})
