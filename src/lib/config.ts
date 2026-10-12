/**
 * Dashboard configuration: shape, defaults and validation (pure, unit-testable).
 *
 * The real values live in config/dashboard.json (git-ignored; copy it from
 * config/dashboard.example.json), read by src/lib/server/config.ts.
 * Anything missing or invalid there falls back to the defaults below, so a typo
 * never takes the kiosk down.
 */

import { BUDDY_COLORS, isBuddy } from './buddies';

export interface Kid {
	name: string;
	/** an animal buddy ("bear", "monkey", "fox", "bunny", "panda", "cat", "dino")
	 *  dressed in the day's outfit, or a twemoji code (e.g. "1f467-1f3fd") */
	avatar: string;
	/** the buddy's clothes colour, e.g. "#3b82f6" */
	color: string;
}

export interface DashboardConfig {
	kids: Kid[];
	location: { name: string; latitude: number; longitude: number };
	school: {
		/** iCal feed of school key dates (no-school days, early releases...) */
		icsUrl: string;
		refreshHours: number;
		/** school-day window (local hours): the outfit uses the weather in this window */
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
		/** from this hour (24h) on, "What to Wear" shows tomorrow's outfit */
		switchToTomorrowHour: number;
	};
	kiosk: {
		/** return to the TODAY tab after this long without a touch (0 = never) */
		idleReturnSeconds: number;
	};
	screen: {
		/** brightness (%) until someone sets their own with the slider */
		brightness: number;
		/** lowest brightness the slider allows, so nobody can "lose" the screen */
		minBrightness: number;
		/** dim after this many idle minutes (0 = never) ... */
		dimAfterMinutes: number;
		/** ... to this brightness (%) */
		dimBrightness: number;
		/** backlight off after this many idle minutes (0 = never); a touch wakes it */
		offAfterMinutes: number;
	};
}

export const DEFAULT_CONFIG: DashboardConfig = {
	kids: [{ name: 'Kids', avatar: 'bear', color: BUDDY_COLORS[0] }],
	location: { name: 'Fairfax, VA', latitude: 38.85, longitude: -77.31 },
	school: {
		icsUrl:
			'https://app.tandem.co/US/VA/Fairfax-County-Public-Schools/?type=export&action=ical&export_type=key_dates&year=2026&page=2',
		refreshHours: 12,
		startHour: 8,
		endHour: 15
	},
	weather: { refreshMinutes: 10 },
	wardrobe: { coldBelowF: 45, coolUpToF: 60, mildUpToF: 72, rainChancePct: 40, switchToTomorrowHour: 18 },
	kiosk: { idleReturnSeconds: 120 },
	screen: { brightness: 100, minBrightness: 10, dimAfterMinutes: 10, dimBrightness: 10, offAfterMinutes: 60 }
};

const EMOJI_CODE = /^[0-9a-f]{4,5}(-[0-9a-f]{4,5})*$/;
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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
	const screen = isObj(r.screen) ? r.screen : {};

	const kids = Array.isArray(r.kids)
		? r.kids
				.filter(isObj)
				.filter((k) => str(k.name, ''))
				.map((k, i) => ({
					name: str(k.name, ''),
					avatar:
						isBuddy(k.avatar) || (typeof k.avatar === 'string' && EMOJI_CODE.test(k.avatar))
							? (k.avatar as string)
							: 'bear',
					color: typeof k.color === 'string' && HEX_COLOR.test(k.color) ? k.color : BUDDY_COLORS[i % BUDDY_COLORS.length]
				}))
		: [];

	const minBrightness = num(screen.minBrightness, d.screen.minBrightness, 1, 100);

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
			rainChancePct: num(wr.rainChancePct, d.wardrobe.rainChancePct, 0, 100),
			switchToTomorrowHour: num(wr.switchToTomorrowHour, d.wardrobe.switchToTomorrowHour, 0, 24)
		},
		kiosk: {
			idleReturnSeconds: num(kiosk.idleReturnSeconds, d.kiosk.idleReturnSeconds, 0)
		},
		screen: {
			brightness: num(screen.brightness, d.screen.brightness, minBrightness, 100),
			minBrightness,
			dimAfterMinutes: num(screen.dimAfterMinutes, d.screen.dimAfterMinutes, 0),
			dimBrightness: num(screen.dimBrightness, d.screen.dimBrightness, 1, 100),
			offAfterMinutes: num(screen.offAfterMinutes, d.screen.offAfterMinutes, 0)
		}
	};
}

/** "Alex & Sam", "A, B & C" */
export function kidNames(kids: Kid[]): string {
	const names = kids.map((k) => k.name);
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
