/**
 * Time-of-day "sky" for the screen background: sunrise peach, daytime cyan,
 * sunset orange-pink, starry night. Uses the real sunrise/sunset when the
 * forecast is loaded, otherwise 7:00 / 18:30.
 */
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

const MIN = 60_000;

export function skyPhase(now: Date, sunrise?: string | null, sunset?: string | null): SkyPhase {
	const at = (iso: string | null | undefined, h: number, m: number) => {
		if (iso) return new Date(iso).getTime();
		const d = new Date(now);
		d.setHours(h, m, 0, 0);
		return d.getTime();
	};
	const rise = at(sunrise, 7, 0);
	const set = at(sunset, 18, 30);
	const t = now.getTime();
	if (t < rise - 30 * MIN || t >= set + 45 * MIN) return 'night';
	if (t < rise + 90 * MIN) return 'dawn';
	if (t >= set - 90 * MIN) return 'dusk';
	return 'day';
}
