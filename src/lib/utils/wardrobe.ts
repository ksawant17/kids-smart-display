/**
 * Wardrobe rule engine.
 *
 * Driven by what it FEELS like during school hours (coldest feels-like
 * temperature between config.school.startHour and endHour: the bus-stop
 * morning matters more than the afternoon high). Default bands (°F):
 *   < 45   -> Winter Coat, Scarf, Gloves, Pants
 *   45-60  -> Light Jacket, Pants
 *   61-72  -> Long-Sleeve Shirt
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
		items.push(ITEMS.longSleeve);
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
	const temp = day.school ? day.school.feels_min_f : (day.temp_min_f + day.temp_max_f) / 2;
	const rain = day.school ? day.school.pop_max : day.rain_max;
	return suggestOutfit(temp, rain, t);
}

/**
 * Which day should the kids dress for? Today until school is out, then
 * tomorrow (so the evening screen helps lay clothes out for the morning).
 */
export function outfitDayIndex(now: Date, schoolEndHour: number): 0 | 1 {
	return now.getHours() >= schoolEndHour ? 1 : 0;
}
