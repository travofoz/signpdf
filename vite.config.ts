import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 4567,
		host: '0.0.0.0',
		allowedHosts: ['signatura.plugpuppy.com'],
		hmr: {
			clientPort: 443,
			protocol: 'wss'
		}
	},
	build: {
		cssMinify: 'lightningcss', 
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
			// Firefox 128 is REQUIRED for @property support.
			targets: { chrome: 120, safari: 17, firefox: 128 }
		}
	}
});