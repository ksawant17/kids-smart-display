/**
 * The top button's gestures, from raw press / release edges:
 *   tap            (released before holdMs)  -> idle screen / screen off
 *   hold           (still down at holdMs)    -> power menu on the screen
 *   reset          (still down at resetMs)   -> restart the kiosk browser
 * Only one gesture per press. Pure (timers injectable) so it can be tested.
 */
export type Gesture = 'tap' | 'hold' | 'reset';

export interface GestureOptions {
	holdMs: number;
	resetMs: number;
}

export class ButtonGestures {
	private down = false;
	private fired: Gesture | null = null;
	private timers: ReturnType<typeof setTimeout>[] = [];

	constructor(
		private emit: (g: Gesture) => void,
		private o: GestureOptions = { holdMs: 2000, resetMs: 10_000 }
	) {}

	press() {
		if (this.down) return;
		this.down = true;
		this.fired = null;
		this.timers = [
			setTimeout(() => this.fire('hold'), this.o.holdMs),
			setTimeout(() => this.fire('reset'), this.o.resetMs)
		];
	}

	release() {
		if (!this.down) return;
		this.down = false;
		this.timers.forEach(clearTimeout);
		this.timers = [];
		if (!this.fired) this.emit('tap');
	}

	private fire(g: Gesture) {
		this.fired = g;
		this.emit(g);
	}
}
