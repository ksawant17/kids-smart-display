/**
 * Loads config/dashboard.json (or $DASHBOARD_CONFIG) on the server, falling
 * back to config/dashboard.example.json on a fresh checkout.
 * The file is re-read whenever it changes; the kiosk re-runs its layout
 * load every hour, so edits show up within the hour without a restart.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveConfig, type DashboardConfig } from '#lib/config';

const CONFIG_PATH = (() => {
	if (process.env.DASHBOARD_CONFIG) return resolve(process.env.DASHBOARD_CONFIG);
	const own = resolve('config/dashboard.json');
	if (existsSync(own)) return own;
	console.warn('[config] config/dashboard.json not found, using config/dashboard.example.json');
	return resolve('config/dashboard.example.json');
})();

let cached: { mtimeMs: number; config: DashboardConfig } | null = null;
let warned = false;

export function getConfig(): DashboardConfig {
	try {
		const { mtimeMs } = statSync(CONFIG_PATH);
		if (cached?.mtimeMs === mtimeMs) return cached.config;
		const config = resolveConfig(JSON.parse(readFileSync(CONFIG_PATH, 'utf8')));
		cached = { mtimeMs, config };
		warned = false;
		return config;
	} catch (err) {
		if (!warned) {
			console.warn(`[config] could not read ${CONFIG_PATH}, using defaults: ${err}`);
			warned = true;
		}
		return cached?.config ?? resolveConfig({});
	}
}
