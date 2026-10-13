import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['tests/**/*.test.ts'],
		// pure logic only: no browser DOM needed (much faster)
		environment: 'node',
		globals: true,
	},
});
