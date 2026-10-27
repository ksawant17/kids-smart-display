import { describe, expect, it } from 'vitest';
import { marathiDigits, panchangFor, panchangMonth, sunTimes, upcomingFestivals } from '../src/lib/utils/panchang';

// Drik Panchang's published dates are for New Delhi
const DELHI = { latitude: 28.6139, longitude: 77.209 };
const FAIRFAX = { latitude: 38.85, longitude: -77.31 };

/** every date (M/D) a festival id falls on in a year */
function datesOf(id: string, year: number, place = DELHI): string[] {
	const out: string[] = [];
	for (let m = 0; m < 12; m++)
		for (const [key, p] of panchangMonth(year, m, place))
			if (p.festivals.some((f) => f.id === id)) out.push(`${Number(key.slice(5, 7))}/${Number(key.slice(8))}`);
	return out;
}

describe('panchang vs Drik Panchang (New Delhi)', () => {
	// prettier-ignore
	const DRIK: Record<string, Record<number, string>> = {
		'gudi-padwa':       { 2026: '3/19', 2027: '4/7',  2028: '3/27', 2029: '4/14', 2030: '4/3' },
		'narali-purnima':   { 2026: '8/28', 2027: '8/17', 2028: '8/5',  2029: '8/23', 2030: '8/13' },
		'gokulashtami':     { 2026: '9/4',  2027: '8/25', 2028: '8/13', 2029: '9/1',  2030: '8/21' },
		'ganesh-chaturthi': { 2026: '9/14', 2027: '9/4',  2028: '8/23', 2029: '9/11', 2030: '9/1' },
		'ghatasthapana':    { 2026: '10/11', 2027: '9/30', 2028: '9/19', 2029: '10/8', 2030: '9/28' },
		'dasara':           { 2026: '10/20', 2027: '10/9', 2028: '9/27', 2029: '10/16', 2030: '10/6' },
		'lakshmi-pujan':    { 2026: '11/8', 2027: '10/29', 2028: '10/17', 2029: '11/5', 2030: '10/26' },
		'bhaubeej':         { 2026: '11/11', 2027: '10/31', 2028: '10/19', 2029: '11/7', 2030: '10/28' },
		'dhulivandan':      { 2027: '3/22', 2028: '3/11', 2029: '3/1', 2030: '3/20' },
		'makar-sankranti':  { 2026: '1/14', 2027: '1/15', 2028: '1/15', 2029: '1/14', 2030: '1/14' }
	};
	for (const [id, years] of Object.entries(DRIK))
		it(id, () => {
			for (const [year, date] of Object.entries(years)) expect([year, datesOf(id, Number(year))]).toEqual([year, [date]]);
		});
});

describe('panchang days', () => {
	it('names the day in Marathi and English, with the Shaka year', () => {
		const p = panchangFor(2027, 4, 7, DELHI);
		expect(p.marathi).toBe('चैत्र शुद्ध प्रतिपदा');
		expect(p.english).toBe('Chaitra Shukla Pratipada');
		expect(p.shaka).toBe(1949);
		expect(panchangFor(2027, 3, 30, DELHI).shaka).toBe(1948);
		// 2026: Pratipada began after sunrise on Gudi Padwa, so the day itself still reads Amavasya
		expect(panchangFor(2026, 3, 19, DELHI)).toMatchObject({ n: 30, shaka: 1947 });
		expect(panchangFor(2026, 3, 19, DELHI).festivals.map((f) => f.id)).toContain('gudi-padwa');
		expect(panchangFor(2026, 11, 9, DELHI).marathi).toBe('आश्विन वद्य अमावास्या');
	});

	it('finds Adhik months (2026 has Adhik Jyeshtha)', () => {
		expect(panchangFor(2026, 6, 1, DELHI)).toMatchObject({ month: 2, adhik: true });
		expect(panchangFor(2026, 6, 1, DELHI).marathi.startsWith('अधिक ज्येष्ठ')).toBe(true);
	});

	it('monthly Ekadashi / Sankashti / Purnima / Amavasya', () => {
		const ids = [...panchangMonth(2026, 9, FAIRFAX).values()].flatMap((p) => p.festivals.map((f) => f.id));
		expect(ids.filter((i) => i === 'ekadashi').length).toBe(2);
		expect(ids).toContain('sankashti');
		expect(ids).toContain('purnima');
	});

	it('sunrise is close to the forecast (Fairfax, Oct 22: 7:25 AM EDT)', () => {
		const rise = new Date((sunTimes(2026, 10, 22, FAIRFAX).rise - 2440587.5) * 86_400_000);
		expect(Math.abs(rise.getTime() - Date.UTC(2026, 9, 22, 11, 25))).toBeLessThan(3 * 60_000);
	});

	it('Marathi digits and the upcoming list', () => {
		expect(marathiDigits(1948)).toBe('१९४८');
		const next = upcomingFestivals('2026-10-22', FAIRFAX, 3);
		expect(next.map((n) => n.festival.id)).toEqual(['kojagiri', 'vasubaras', 'dhanteras']);
	});
});
