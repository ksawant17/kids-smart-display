/**
 * Pure helpers for the grown-ups (admin) tab: ZIP / PIN checks, place names,
 * time zones and parsing `timedatectl show`. Shared by the server and the page.
 */
import type { DashboardConfig } from '#lib/config';

/** kids on the dashboard (the TODAY tab has room for four buddies) */
export const MAX_KIDS = 4;

export const isZip = (s: unknown): s is string => typeof s === 'string' && /^\d{5}$/.test(s);
export const isPin = (s: unknown): s is string => typeof s === 'string' && /^\d{4}$/.test(s);

const STATES: Record<string, string> = {
	Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
	Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', 'Washington, D.C.': 'DC',
	Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
	Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA',
	Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE',
	Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
	'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
	Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
	Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
	'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'Puerto Rico': 'PR', Guam: 'GU',
	'U.S. Virgin Islands': 'VI'
};

/** "Fairfax" + "Virginia" -> "Fairfax, VA" (unknown states are kept as written). */
export function placeName(city: string, state?: string): string {
	if (!state) return city;
	return `${city}, ${STATES[state] ?? state}`;
}

/** US time zones offered on the time screen (any other zone still works). */
export const US_TIMEZONES: { id: string; label: string }[] = [
	{ id: 'America/New_York', label: 'Eastern' },
	{ id: 'America/Chicago', label: 'Central' },
	{ id: 'America/Denver', label: 'Mountain' },
	{ id: 'America/Phoenix', label: 'Arizona' },
	{ id: 'America/Los_Angeles', label: 'Pacific' },
	{ id: 'America/Anchorage', label: 'Alaska' },
	{ id: 'Pacific/Honolulu', label: 'Hawaii' }
];

/** "America/New_York" -> "Eastern"; other zones -> "Europe/London" style, underscores as spaces. */
export function tzLabel(id: string): string {
	return US_TIMEZONES.find((z) => z.id === id)?.label ?? id.replace(/_/g, ' ');
}

/** IANA zone names only ("Area/City", "UTC"): keeps odd input away from timedatectl. */
export const isTimezone = (s: unknown): s is string =>
	typeof s === 'string' && s.length < 64 && /^(UTC|[A-Z][A-Za-z_-]+(\/[A-Za-z0-9_+-]+){1,2})$/.test(s);

/** "YYYY-MM-DD HH:MM" (local wall time for `timedatectl set-time`). */
export const isLocalDateTime = (s: unknown): s is string =>
	typeof s === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s);

export interface TimeStatus {
	timezone: string;
	/** automatic time from the internet (systemd-timesyncd) */
	ntp: boolean;
	/** the clock has actually synced */
	synced: boolean;
}

/** Parse `timedatectl show` (Key=value lines). */
export function parseTimedate(text: string): TimeStatus {
	const kv = Object.fromEntries(
		text
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.includes('='))
			.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
	);
	return { timezone: kv.Timezone || 'UTC', ntp: kv.NTP === 'yes', synced: kv.NTPSynchronized === 'yes' };
}

/** "3 days 4 h" / "5 h 12 min" / "8 min" */
export function uptimeLabel(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d) return `${d} day${d === 1 ? '' : 's'} ${h} h`;
	if (h) return `${h} h ${m} min`;
	return `${m} min`;
}

/* --------------------------------- Wi-Fi -------------------------------- */

/** split one line of `nmcli -t` output (fields joined by ":", with "\:" escapes) */
export function splitTerse(line: string): string[] {
	const out: string[] = [];
	let cur = '';
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '\\' && i + 1 < line.length) cur += line[++i];
		else if (c === ':') {
			out.push(cur);
			cur = '';
		} else cur += c;
	}
	out.push(cur);
	return out;
}

export interface WifiNetwork {
	ssid: string;
	/** 0-100 */
	signal: number;
	/** needs a password */
	secure: boolean;
	inUse: boolean;
}

/** `nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY dev wifi list` -> one entry per name, strongest first */
export function parseWifiList(text: string): WifiNetwork[] {
	const best = new Map<string, WifiNetwork>();
	for (const line of text.split('\n')) {
		if (!line.trim()) continue;
		const [use, ssid, signal, security] = splitTerse(line);
		if (!ssid) continue; // hidden networks
		const net = { ssid, signal: Number(signal) || 0, secure: !!security && security !== '--', inUse: use === '*' };
		const old = best.get(ssid);
		if (!old || net.inUse || (!old.inUse && net.signal > old.signal)) best.set(ssid, net);
	}
	return [...best.values()].sort((a, b) => Number(b.inUse) - Number(a.inUse) || b.signal - a.signal);
}

/** 1-4 bars from a 0-100 signal */
export const signalBars = (signal: number) => (signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1);

/* ------------------------------ admin status ----------------------------- */

/** what GET /api/admin returns */
export interface AdminStatus {
	settings: Pick<DashboardConfig, 'kids' | 'location' | 'school' | 'wardrobe' | 'kiosk' | 'bedtime'> & {
		screen: Pick<DashboardConfig['screen'], 'dimAfterMinutes' | 'offAfterMinutes'>;
	};
	time: TimeStatus;
	system: {
		hostname: string;
		ip: string[];
		uptimeSeconds: number;
		tempC: number | null;
		diskFreeGb: number | null;
		wifi: string | null;
	};
	permissions: { power: boolean; clock: boolean; wifi: boolean };
	/** new quotes / facts waiting for Keep or Skip */
	contentPending: number;
}

/** "20:30" -> "8:30 PM" */
export function hhmmLabel(hhmm: string): string {
	const [h, m] = hhmm.split(':').map(Number);
	const d = new Date(2000, 0, 1, h, m);
	return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}


/** what the Updates section shows (GET /api/admin/update) */
export interface UpdateInfo {
	/** "a48ac06" */
	version: string;
	date: string;
	subject: string;
	/** new changes waiting on GitHub (null: couldn't check) */
	behind: number | null;
	waiting: string[];
	/** changed files in the checkout: updating could clash, so it is refused */
	localChanges: boolean;
	running: boolean;
	/** last lines of the latest update's log */
	log: string[];
}
