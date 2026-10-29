/**
 * The AI briefing, shared by TODAY (the ✨ strip) and the idle screen (its
 * 🔊 Read me button). The root layout works out the facts the screen shows
 * (`briefingFacts`), asks the server for the two friendly sentences, and
 * keeps the answer in `briefing`.
 */
import { writable } from 'svelte/store';
import type { WeatherData } from '#lib/types';
import type { ParentMessage } from '#lib/utils/messages';
import type { SchoolEvent } from '#lib/utils/schoolCalendar';
import type { Place } from '#lib/utils/panchang';
import { keyOf, parseKey, todayStatus, tomorrowStatus } from '#lib/utils/schoolCalendar';
import { messagesOn } from '#lib/utils/messages';
import { outfitForDay, type WardrobeThresholds } from '#lib/utils/wardrobe';
import { skyStory } from '#lib/utils/forecastStory';
import { weatherLabel } from '#lib/utils/weatherCodes';
import { festivalBanner, themeFor } from '#lib/themes';

export interface Briefing {
	text: string;
	when: 'today' | 'tomorrow';
}

export const briefing = writable<Briefing | null>(null);

/**
 * The same facts TODAY shows, as the JSON the server wants ('' while the
 * weather isn't in yet). From `switchToTomorrowHour` on, it's about tomorrow.
 */
export function briefingFacts(o: {
	wx: WeatherData | null;
	now: Date;
	todayKey: string;
	wardrobe: WardrobeThresholds & { switchToTomorrowHour: number };
	schoolEvents: SchoolEvent[];
	messages: ParentMessage[];
	place: Place;
}): string {
	const evening = o.now.getHours() >= o.wardrobe.switchToTomorrowHour;
	const dayIdx = evening && (o.wx?.days.length ?? 0) > 1 ? 1 : 0;
	const day = o.wx?.days[dayIdx];
	if (!o.wx || !day) return '';
	let dayKey = o.todayKey;
	if (dayIdx === 1) {
		const d = parseKey(o.todayKey);
		d.setDate(d.getDate() + 1);
		dayKey = keyOf(d);
	}
	const date = parseKey(dayKey);
	const story = skyStory(day, dayIdx === 1 ? day.hours : o.wx.hourly.slice(0, 9));
	const school = dayIdx === 1 ? tomorrowStatus(o.schoolEvents, dayKey) : todayStatus(o.schoolEvents, dayKey);
	const notes = messagesOn(o.messages, dayKey);
	const theme = themeFor(date, o.place);
	return JSON.stringify({
		when: dayIdx === 1 ? 'tomorrow' : 'today',
		dayName: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
		weather: `${weatherLabel(day.code, true)}, high ${Math.round(day.temp_max_f)}°F, low ${Math.round(day.temp_min_f)}°F. ${story}`,
		school: [school.title, school.subtitle].filter(Boolean).join(', '),
		wear: outfitForDay(day, o.wardrobe).summary,
		note: notes.map((n) => n.text).join(' / ') || undefined,
		festival: theme ? festivalBanner(theme, date) : undefined
	});
}
