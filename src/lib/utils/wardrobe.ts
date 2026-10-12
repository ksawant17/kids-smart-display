/**
 * Wardrobe rule engine.
 *
 * Driven by what it FEELS like during school hours (config.school.startHour
 * to endHour): the middle of that range picks the outfit, and a cool morning
 * on a warm day adds a Light Jacket layer for the bus stop. Bands (°F):
 *   < 45   -> Winter Coat, Scarf, Gloves, Pants
 *   45-60  -> Light Jacket, Pants
 *   61-72  -> Long-Sleeve Shirt, Pants
 *   > 72   -> T-Shirt, Shorts
 * School-hours rain chance > 40% -> add Umbrella + Rain Boots.
 * Thresholds come from config.wardrobe.
 */
import type { DaySummary } from '#lib/types';

export interface WardrobeItem {
	name: string;
	/** twemoji code (rendered as a local <img> sticker) */
	emoji: string;
}

export interface WardrobeResult {
	items: WardrobeItem[];
	/** short one-line summary, e.g. "Light Jacket & Umbrella" */
	summary: string;
	/** the key item's emoji, for headline icons */
	emoji: string;
	rainy: boolean;
}

export interface WardrobeThresholds {
	coldBelowF: number;
	coolUpToF: number;
	mildUpToF: number;
	rainChancePct: number;
	switchToTomorrowHour?: number;
}

export const DEFAULT_THRESHOLDS: WardrobeThresholds = {
	coldBelowF: 45,
	coolUpToF: 60,
	mildUpToF: 72,
	rainChancePct: 40
};

const ITEMS = {
	winterCoat: { name: 'Winter Coat', emoji: '1f9e5' },
	scarf: { name: 'Scarf', emoji: '1f9e3' },
	gloves: { name: 'Gloves', emoji: '1f9e4' },
	lightJacket: { name: 'Light Jacket', emoji: '1f9e5' },
	pants: { name: 'Pants', emoji: '1f456' },
	longSleeve: { name: 'Long-Sleeve Shirt', emoji: '1f455' },
	tshirt: { name: 'T-Shirt', emoji: '1f455' },
	shorts: { name: 'Shorts', emoji: '1fa73' },
	sneakers: { name: 'Sneakers', emoji: '1f45f' },
	umbrella: { name: 'Umbrella', emoji: '2614' },
	rainBoots: { name: 'Rain Boots', emoji: '1f462' }
} satisfies Record<string, WardrobeItem>;

export function suggestOutfit(
	tempF: number,
	rainChancePct: number,
	t: WardrobeThresholds = DEFAULT_THRESHOLDS
): WardrobeResult {
	const items: WardrobeItem[] = [];

	if (tempF < t.coldBelowF) {
		items.push(ITEMS.winterCoat, ITEMS.scarf, ITEMS.gloves, ITEMS.pants);
	} else if (tempF <= t.coolUpToF) {
		items.push(ITEMS.lightJacket, ITEMS.pants);
	} else if (tempF <= t.mildUpToF) {
		items.push(ITEMS.longSleeve, ITEMS.pants);
	} else {
		items.push(ITEMS.tshirt, ITEMS.shorts);
	}

	const rainy = rainChancePct > t.rainChancePct;
	// rain boots replace sneakers on rainy days
	if (rainy) items.push(ITEMS.umbrella, ITEMS.rainBoots);
	else items.push(ITEMS.sneakers);

	// Summary: the key top piece + umbrella (rainy) or sneakers.
	const top = items[0];
	const partner = rainy ? ITEMS.umbrella : ITEMS.sneakers;
	return { items, summary: `${top.name} & ${partner.name}`, emoji: top.emoji, rainy };
}

/** Outfit for a forecast day, using school-hours conditions when available. */
export function outfitForDay(day: DaySummary, t: WardrobeThresholds = DEFAULT_THRESHOLDS): WardrobeResult {
	const low = day.school ? day.school.feels_min_f : day.temp_min_f;
	const high = day.school ? day.school.feels_max_f : day.temp_max_f;
	const rain = day.school ? day.school.pop_max : day.rain_max;
	const mid = (low + high) / 2;
	const result = suggestOutfit(mid, rain, t);
	// chilly start to a warm day: bring a layer for the morning
	if (low <= t.coolUpToF && mid > t.coolUpToF) {
		result.items.splice(1, 0, ITEMS.lightJacket);
	}
	return result;
}

/**
 * Which day should the kids dress for? Today until the evening switch hour
 * (config.wardrobe.switchToTomorrowHour, default 6 PM), then tomorrow, so the
 * evening screen helps lay clothes out for the morning.
 */
export function outfitDayIndex(now: Date, switchHour: number): 0 | 1 {
	return now.getHours() >= switchHour ? 1 : 0;
}

/** "Today" / "Tomorrow" / "Wednesday" for a forecast day index. */
export function dayName(dateKey: string, index: number): string {
	if (index === 0) return 'Today';
	if (index === 1) return 'Tomorrow';
	const [y, m, d] = dateKey.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}
