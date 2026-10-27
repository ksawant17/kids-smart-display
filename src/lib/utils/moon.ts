/**
 * Moon phase, calculated locally (no internet): days since a known new moon
 * (2000-01-06 18:14 UTC) modulo the synodic month (29.53 days). Accurate to
 * within about a day, which is plenty for "what does the moon look like tonight".
 */
const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export interface MoonPhase {
	/** 0 = new, 0.5 = full, back to 1 */
	fraction: number;
	/** 0-100 % of the disc lit */
	illumination: number;
	name: string;
	/** twemoji code */
	emoji: string;
}

const PHASES: [number, string, string][] = [
	[0.0339, 'New Moon', '1f311'],
	[0.216, 'Waxing Crescent', '1f312'],
	[0.284, 'First Quarter', '1f313'],
	[0.466, 'Waxing Gibbous', '1f314'],
	[0.534, 'Full Moon', '1f315'],
	[0.716, 'Waning Gibbous', '1f316'],
	[0.784, 'Last Quarter', '1f317'],
	[0.966, 'Waning Crescent', '1f318'],
	[1.0001, 'New Moon', '1f311']
];

export function moonPhase(date: Date): MoonPhase {
	const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
	const fraction = (((days / SYNODIC) % 1) + 1) % 1;
	const illumination = Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100);
	const [, name, emoji] = PHASES.find(([upTo]) => fraction < upTo)!;
	return { fraction, illumination, name, emoji };
}

/**
 * SVG path of the lit part of the moon for a phase fraction (0 = new,
 * 0.5 = full), on a disc of radius r centred at (r, r). Waxing moons are lit
 * on the right, waning on the left (as seen from the northern hemisphere);
 * the terminator is a half-ellipse whose width follows cos(2πf).
 */
export function moonLitPath(fraction: number, r: number): string {
	const k = Math.cos(2 * Math.PI * fraction);
	const rx = Math.abs(k) * r;
	const waxing = fraction < 0.5;
	const top = `${r},0`;
	const bottom = `${r},${2 * r}`;
	// edge: top -> bottom round the lit side; terminator: back up again
	const edgeSweep = waxing ? 1 : 0;
	const termSweep = waxing === k > 0 ? 0 : 1;
	return `M${top} A${r},${r} 0 0 ${edgeSweep} ${bottom} A${rx.toFixed(2)},${r} 0 0 ${termSweep} ${top} Z`;
}
