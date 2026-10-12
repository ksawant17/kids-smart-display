/**
 * Dashboard configuration: shape, defaults and validation (pure, unit-testable).
 *
 * The real values live in config/dashboard.json (git-ignored; copy it from
 * config/dashboard.example.json), read by src/lib/server/config.ts.
 * Anything missing or invalid there falls back to the defaults below, so a typo
 * never takes the kiosk down.
 */

export interface Kid {
	name: string;
	/** twemoji code for the kid's avatar, e.g. "1f467-1f3fd" */
	avatar: string;
}

export interface DashboardConfig {
	kids: Kid[];
	location: { name: string; latitude: number; longitude: number };
	school: {
		/** iCal feed of school key dates (no-school days, early releases...) */
		icsUrl: string;
		refreshHours: number;
		/** school-day window (local hours) used for the outfit + "after school" logic */
		startHour: number;
		endHour: number;
	};
	weather: { refreshMinutes: number };
	wardrobe: {
		/** feels-like °F during school hours */
		coldBelowF: number;
		coolUpToF: number;
		mildUpToF: number;
		/** rain gear when the school-hours rain chance is above this */
		rainChancePct: number;
	};
	kiosk: {
		/** return to the TODAY tab after this long without a touch (0 = never) */
		idleReturnSeconds: number;
		/** dim the screen overnight ("HH:MM" local; opacity of the dark overlay) */
		nightDim: { from: string; to: string; opacity: number } | null;
	};
}

export const DEFAULT_CONFIG: DashboardConfig = {
	kids: [{ name: 'Kids', avatar: '1f9d2' }],
	location: { name: 'Fairfax, VA', latitude: 38.85, longitude: -77.31 },
	school: {
		icsUrl:
			'https://app.tandem.co/US/VA/Fairfax-County-Public-Schools/?type=export&action=ical&export_type=key_dates&year=2026&page=2',
		refreshHours: 12,
		startHour: 8,
		endHour: 15
	},
	weather: { refreshMinutes: 10 },
	wardrobe: { coldBelowF: 45, coolUpToF: 60, mildUpToF: 72, rainChancePct: 40 },
	kiosk: {
		idleReturnSeconds: 120,
		nightDim: { from: '20:30', to: '06:30', opacity: 0.55 }
	}
};

const EMOJI_CODE = /^[0-9a-f]{4,5}(-[0-9a-f]{4,5})*$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

/** Merge raw (parsed JSON) config over the defaults, dropping anything invalid. */
export function resolveConfig(raw: unknown): DashboardConfig {
	const d = DEFAULT_CONFIG;
	const r = isObj(raw) ? raw : {};
	const loc = isObj(r.location) ? r.location : {};
	const school = isObj(r.school) ? r.school : {};
	const weather = isObj(r.weather) ? r.weather : {};
	const wr = isObj(r.wardrobe) ? r.wardrobe : {};
	const kiosk = isObj(r.kiosk) ? r.kiosk : {};

	const kids = Array.isArray(r.kids)
		? r.kids
				.filter(isObj)
				.map((k) => ({
					name: str(k.name, ''),
					avatar: typeof k.avatar === 'string' && EMOJI_CODE.test(k.avatar) ? k.avatar : '1f9d2'
				}))
				.filter((k) => k.name)
		: [];

	let nightDim: DashboardConfig['kiosk']['nightDim'] = d.kiosk.nightDim;
	if (kiosk.nightDim === null || kiosk.nightDim === false) nightDim = null;
	else if (isObj(kiosk.nightDim)) {
		const n = kiosk.nightDim;
		nightDim = {
			from: typeof n.from === 'string' && HHMM.test(n.from) ? n.from : d.kiosk.nightDim!.from,
			to: typeof n.to === 'string' && HHMM.test(n.to) ? n.to : d.kiosk.nightDim!.to,
			opacity: num(n.opacity, d.kiosk.nightDim!.opacity, 0, 0.9)
		};
	}

	return {
		kids: kids.length ? kids : d.kids,
		location: {
			name: str(loc.name, d.location.name),
			latitude: num(loc.latitude, d.location.latitude, -90, 90),
			longitude: num(loc.longitude, d.location.longitude, -180, 180)
		},
		school: {
			icsUrl: str(school.icsUrl, d.school.icsUrl),
			refreshHours: num(school.refreshHours, d.school.refreshHours, 1, 24 * 7),
			startHour: num(school.startHour, d.school.startHour, 0, 23),
			endHour: num(school.endHour, d.school.endHour, 1, 24)
		},
		weather: { refreshMinutes: num(weather.refreshMinutes, d.weather.refreshMinutes, 5, 180) },
		wardrobe: {
			coldBelowF: num(wr.coldBelowF, d.wardrobe.coldBelowF),
			coolUpToF: num(wr.coolUpToF, d.wardrobe.coolUpToF),
			mildUpToF: num(wr.mildUpToF, d.wardrobe.mildUpToF),
			rainChancePct: num(wr.rainChancePct, d.wardrobe.rainChancePct, 0, 100)
		},
		kiosk: {
			idleReturnSeconds: num(kiosk.idleReturnSeconds, d.kiosk.idleReturnSeconds, 0),
			nightDim
		}
	};
}

/** "Alex & Sam", "A, B & C" */
export function kidNames(kids: Kid[]): string {
	const names = kids.map((k) => k.name);
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** Is "now" inside a [from, to) "HH:MM" window that may wrap past midnight? */
export function inTimeWindow(now: Date, from: string, to: string): boolean {
	const mins = now.getHours() * 60 + now.getMinutes();
	const [fh, fm] = from.split(':').map(Number);
	const [th, tm] = to.split(':').map(Number);
	const a = fh * 60 + fm;
	const b = th * 60 + tm;
	return a <= b ? mins >= a && mins < b : mins >= a || mins < b;
}
