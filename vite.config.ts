import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 4567,
		host: '0.0.0.0',
		allowedHosts: ['signpdf.leadplateau.com'],
		hmr: {
			clientPort: 443,
			protocol: 'wss'
		}
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
						return 'pdfjs';
					}
				}
			}
		},
		chunkSizeWarningLimit: 1000
	},
	css: {
		transformer: 'lightningcss',
		lightningcss: {
			targets: { chrome: 120, safari: 16, firefox: 120 }
		}
	},
	// Suppress warnings about modern CSS features
	logLevel: 'error'
});
