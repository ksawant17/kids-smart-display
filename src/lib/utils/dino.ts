/** Dino of the Day helpers. */

export interface Dino {
	name: string;
	/** pronunciation, e.g. "tie-RAN-oh-SORE-us rex" */
	say: string;
	/** what the name means */
	means: string;
	lengthFt: number;
	diet: 'meat' | 'plants' | 'fish';
	period: string;
	fact: string;
}

/** Twemoji only has two dinos: the T. rex for meat-eaters, the long-neck for plant-eaters. */
export function dinoEmoji(d: Dino): string {
	return d.diet === 'plants' ? '1f995' : '1f996';
}

export function dietEmoji(d: Dino): string {
	return d.diet === 'plants' ? '1f33f' : d.diet === 'fish' ? '1f41f' : '1f356';
}

/** Kid-scale size: "As long as 2 school buses!" / "As long as 8 kids lying head to toe!" */
export function dinoSize(lengthFt: number): string {
	const BUS_FT = 40;
	const KID_FT = 4;
	if (lengthFt >= 35) {
		const buses = Math.round((lengthFt / BUS_FT) * 2) / 2;
		return buses === 1 ? 'As long as a school bus!' : `As long as ${buses} school buses!`;
	}
	if (lengthFt < KID_FT) return 'Smaller than you!';
	const kids = Math.round(lengthFt / KID_FT);
	return kids === 1 ? 'About as long as you are tall!' : `As long as ${kids} kids lying head to toe!`;
}
