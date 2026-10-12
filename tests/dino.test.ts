import { describe, expect, it } from 'vitest';
import dinos from '../src/lib/data/dinos.json';
import { dinoEmoji, dinoSize, type Dino } from '../src/lib/utils/dino';

describe('dinos', () => {
	it('has a full set of fields for every dino', () => {
		expect(dinos.length).toBeGreaterThanOrEqual(10);
		for (const d of dinos as Dino[]) {
			expect(d.name && d.say && d.fact && d.period).toBeTruthy();
			expect(['meat', 'plants', 'fish']).toContain(d.diet);
			expect(d.lengthFt).toBeGreaterThan(0);
		}
	});

	it('meat-eaters get the T. rex, plant-eaters the long-neck', () => {
		const rex = (dinos as Dino[]).find((d) => d.name === 'Tyrannosaurus rex')!;
		const bronto = (dinos as Dino[]).find((d) => d.name === 'Brachiosaurus')!;
		expect(dinoEmoji(rex)).toBe('1f996');
		expect(dinoEmoji(bronto)).toBe('1f995');
	});
});

describe('dinoSize', () => {
	it('uses school buses for giants and kids for the rest', () => {
		expect(dinoSize(40)).toBe('As long as a school bus!');
		expect(dinoSize(85)).toBe('As long as 2 school buses!');
		expect(dinoSize(100)).toBe('As long as 2.5 school buses!');
		expect(dinoSize(30)).toBe('As long as 8 kids lying head to toe!');
		expect(dinoSize(2.5)).toBe('Smaller than you!');
	});
});
