/**
 * Loads config/dashboard.json (or $DASHBOARD_CONFIG) on the server, falling
 * back to config/dashboard.example.json on a fresh checkout.
 * The file is re-read whenever it changes; the kiosk re-runs its layout
 * load every hour, so edits show up within the hour without a restart.
 * The admin tab saves its changes here too (updateConfig).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { resolveConfig, type DashboardConfig } from '#lib/config';

/** where settings live (and where the admin tab writes them) */
const OWN_PATH = resolve(process.env.DASHBOARD_CONFIG ?? 'config/dashboard.json');
const EXAMPLE_PATH = resolve('config/dashboard.example.json');

let cached: { path: string; mtimeMs: number; config: DashboardConfig } | null = null;
let warned = false;
let warnedExample = false;

function readPath(): string {
	if (process.env.DASHBOARD_CONFIG || existsSync(OWN_PATH)) return OWN_PATH;
	if (!warnedExample) {
		console.warn('[config] config/dashboard.json not found, using config/dashboard.example.json');
		warnedExample = true;
	}
	return EXAMPLE_PATH;
}

export function getConfig(): DashboardConfig {
	const path = readPath();
	try {
		const { mtimeMs } = statSync(path);
		if (cached?.path === path && cached.mtimeMs === mtimeMs) return cached.config;
		const config = resolveConfig(JSON.parse(readFileSync(path, 'utf8')));
		cached = { path, mtimeMs, config };
		warned = false;
		return config;
	} catch (err) {
		if (!warned) {
			console.warn(`[config] could not read ${path}, using defaults: ${err}`);
			warned = true;
		}
		return cached?.config ?? resolveConfig({});
	}
}

type Section = Record<string, unknown>;

/**
 * Merge `patch` into the settings file, section by section
 * ({ location: {...}, screen: {...} }), keeping everything else as written;
 * `replace` swaps whole entries instead (e.g. { kids: [...] }).
 * Starts from the example on a fresh checkout. Written atomically, so the
 * kiosk never reads half a file.
 */
export function updateConfig(patch: Record<string, Section>, replace: Record<string, unknown> = {}): DashboardConfig {
	const source = existsSync(OWN_PATH) ? OWN_PATH : EXAMPLE_PATH;
	let raw: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(readFileSync(source, 'utf8'));
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
	} catch {
		/* unreadable: start over from the patch (defaults fill the rest) */
	}
	for (const [key, section] of Object.entries(patch)) {
		const old = raw[key];
		raw[key] = old && typeof old === 'object' && !Array.isArray(old) ? { ...old, ...section } : { ...section };
	}
	Object.assign(raw, replace);
	mkdirSync(dirname(OWN_PATH), { recursive: true });
	const tmp = `${OWN_PATH}.tmp`;
	writeFileSync(tmp, JSON.stringify(raw, null, '\t') + '\n');
	renameSync(tmp, OWN_PATH);
	cached = null;
	return getConfig();
}
