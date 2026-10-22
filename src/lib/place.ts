/**
 * Where the dashboard is (config location), for the Marathi calendar and the
 * festival themes. Set by +layout.svelte from the server's config.
 */
import { writable } from 'svelte/store';
import { DEFAULT_PLACE } from '#lib/themes';
import type { Place } from '#lib/utils/panchang';

export const place = writable<Place>(DEFAULT_PLACE);
