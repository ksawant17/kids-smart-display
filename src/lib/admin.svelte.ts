/**
 * The admin tab's session on the client: talks to /api/admin/*, keeps the
 * latest status, shows notes (toasts) and locks the page again when the
 * server says the PIN is needed (401). One instance per admin page, handed
 * to every section.
 */
import { invalidateAll } from '$app/navigation';
import { tzLabel, type AdminStatus, type TimeStatus } from '#lib/utils/admin';

export class Locked extends Error {}

export type AdminSettings = AdminStatus['settings'];

export class AdminSession {
	phase = $state<'loading' | 'locked' | 'open' | 'bye'>('loading');
	pinSet = $state(true);
	status = $state<AdminStatus | null>(null);
	busy = $state(false);
	note = $state<{ text: string; bad?: boolean } | null>(null);
	bye = $state('');

	async api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
		const res = await fetch(path, {
			method,
			headers: data === undefined ? undefined : { 'content-type': 'application/json' },
			body: data === undefined ? undefined : JSON.stringify(data)
		});
		if (res.status === 401) {
			this.lock(false);
			throw new Locked();
		}
		const body = await res.json().catch(() => null);
		if (!res.ok) throw new Error(body?.message ?? `Something went wrong (${res.status})`);
		return body as T;
	}

	/** run an action, showing a note if it fails; false = it failed */
	async attempt(fn: () => Promise<unknown>): Promise<boolean> {
		this.busy = true;
		this.note = null;
		try {
			await fn();
			return true;
		} catch (e) {
			if (!(e instanceof Locked)) this.say(e instanceof Error ? e.message : String(e), true);
			return false;
		} finally {
			this.busy = false;
		}
	}

	say(text: string, bad = false) {
		this.note = { text, bad };
	}

	refresh() {
		return this.attempt(async () => (this.status = await this.api<AdminStatus>('/api/admin')));
	}

	/** save settings sections (see POST /api/admin); the kiosk picks them up at once */
	async save(patch: Record<string, unknown>, done = 'Saved'): Promise<boolean> {
		const ok = await this.attempt(async () => {
			const settings = await this.api<AdminSettings>('/api/admin', 'POST', patch);
			if (this.status) this.status.settings = settings;
		});
		if (ok) {
			this.say(done);
			await invalidateAll();
		}
		return ok;
	}

	/** change the Pi's time zone; the kiosk browser restarts to pick it up */
	async changeZone(tz: string) {
		let restarting = false;
		await this.attempt(async () => {
			const t = await this.api<TimeStatus & { restarting: boolean }>('/api/admin/time', 'POST', { timezone: tz });
			restarting = t.restarting;
			if (this.status) this.status.time = t;
		});
		if (restarting) this.goodbye(`Time zone is now ${tzLabel(tz)}. Restarting the screen…`);
	}

	lock(tellServer = true) {
		if (tellServer) fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {});
		this.phase = 'locked';
		this.status = null;
	}

	/** full-screen goodbye (restart, power off, update...) */
	goodbye(text: string) {
		this.bye = text;
		this.phase = 'bye';
	}
}
