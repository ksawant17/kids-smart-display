/**
 * Tiny in-memory TTL cache (the kiosk server is a single process).
 * Expired entries are kept so callers can fall back to stale data when the
 * upstream service is down: a slightly old forecast beats an error screen.
 */
export class TtlCache<T> {
	private store = new Map<string, { at: number; value: T }>();

	constructor(private ttlMs: number) {}

	/** Fresh value, or undefined if missing/expired. */
	get(key: string): T | undefined {
		const hit = this.store.get(key);
		if (!hit || Date.now() - hit.at > this.ttlMs) return undefined;
		return hit.value;
	}

	/** Last value stored, however old. */
	getStale(key: string): T | undefined {
		return this.store.get(key)?.value;
	}

	set(key: string, value: T): void {
		this.store.set(key, { at: Date.now(), value });
	}
}
