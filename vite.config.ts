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
	}
});
