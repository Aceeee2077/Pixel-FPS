import { defineConfig, type Plugin } from 'vite';
import { createReadStream, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Serve the Draco decoder straight out of node_modules.
 *
 * The weapon GLBs are Draco-compressed, so the page needs three.js's matching
 * decoder. Copying ~1 MB of wasm into the repo would duplicate a dependency and
 * risk drifting from the installed three version, so both the dev server and
 * the production build take the files from `three/examples/jsm/libs/draco/`.
 */
const DRACO_SOURCES = ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js'];

function dracoDecoder(): Plugin {
    const dracoDir = resolve(__dirname, 'node_modules/three/examples/jsm/libs/draco');
    const route = '/draco/';
    const resolveFile = (url: string) => {
        const name = url.slice(route.length).split('?')[0];
        if (!DRACO_SOURCES.includes(name)) return null;
        const file = join(dracoDir, name);
        return existsSync(file) ? file : null;
    };
    return {
        name: 'blockstrike:draco-decoder',
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                if (!request.url?.startsWith(route)) return next();
                const file = resolveFile(request.url);
                if (!file) return next();
                response.setHeader('Content-Type',
                    file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
                response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                createReadStream(file).pipe(response);
            });
        },
        writeBundle(options) {
            // Emit the decoder next to the built app so the deployed site works
            // exactly like the dev server, without vendoring the files.
            const outDir = options.dir ?? resolve(__dirname, 'dist');
            const target = join(outDir, 'draco');
            if (!existsSync(dracoDir)) return;
            mkdirSync(target, { recursive: true });
            for (const name of DRACO_SOURCES) {
                const source = join(dracoDir, name);
                if (existsSync(source)) copyFileSync(source, join(target, name));
            }
        },
    };
}

export default defineConfig({
    plugins: [dracoDecoder()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        watch: { ignored: ['**/*.png', '**/*.jpg'] },
    },
    build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
