/**
 * One shared, self-refreshing weather feed for every page (TODAY, WARDROBE
 * and the full report). The root layout starts polling; pages just read
 * $weather. Failed fetches retry after a minute and never wipe good data.
 */
import { writable } from 'svelte/store';
import type { WeatherData } from '#lib/types';

export interface WeatherState {
	data: WeatherData | null;
	/** set when the latest attempt failed; `data` may still hold an older forecast */
	error: string | null;
}

export const weather = writable<WeatherState>({ data: null, error: null });

const RETRY_MS = 60_000;

export async function loadWeather(): Promise<boolean> {
	try {
		const res = await fetch('/api/weather');
		const body = await res.json().catch(() => null);
		if (!res.ok || !body || body.error || !Array.isArray(body.days)) {
			throw new Error(body?.error ?? `HTTP ${res.status}`);
		}
		weather.set({ data: body as WeatherData, error: null });
		return true;
	} catch (e) {
		weather.update((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
		return false;
	}
}

/** Start polling; returns a stop function (use from onMount / $effect). */
export function startWeather(refreshMinutes: number): () => void {
	let timer: ReturnType<typeof setTimeout>;
	let stopped = false;
	const tick = async () => {
		const ok = await loadWeather();
		if (!stopped) timer = setTimeout(tick, ok ? refreshMinutes * 60_000 : RETRY_MS);
	};
	tick();
	return () => {
		stopped = true;
		clearTimeout(timer);
	};
}
