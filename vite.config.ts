import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Node adapter: builds to build/index.js (run with `node build/index.js`).
			// BUILD_OUT lets the updater build next to the running copy, then swap.
			adapter: adapter({ out: process.env.BUILD_OUT ?? 'build' }),

			// the kiosk checks for a new build every minute and reloads itself
			version: { pollInterval: 60_000 }
		})
	]
});
