/**
 * Grown-ups PIN for the admin tab.
 *
 * The 4-digit PIN is stored as a salted scrypt hash in data/admin.json (made
 * the first time the admin tab is opened; delete the file to start over).
 * A correct PIN opens a short session (httpOnly cookie, kept in memory, so a
 * server restart logs everyone out). Wrong guesses are rate-limited, because
 * the server also answers on the home network: 5 tries, then a lockout that
 * doubles each time (5 min, 10, 20... up to an hour) until the right PIN.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { error, type Cookies } from '@sveltejs/kit';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'admin.json');
export const COOKIE = 'grownups';
/** a session ends after this long without any admin request */
const SESSION_MS = 10 * 60_000;
const MAX_TRIES = 5;
const LOCK_MS = 5 * 60_000;
const MAX_LOCK_MS = 60 * 60_000;

const sessions = new Map<string, number>(); // token -> expires at
let failures = 0;
let lockedUntil = 0;
let lockouts = 0; // in a row, without a correct PIN in between

interface Saved {
	salt: string;
	hash: string;
}

function load(): Saved | null {
	try {
		const s = JSON.parse(readFileSync(FILE, 'utf8'));
		return typeof s?.salt === 'string' && typeof s?.hash === 'string' ? s : null;
	} catch {
		return null;
	}
}

const hashPin = (pin: string, salt: string) => scryptSync(pin, salt, 32).toString('hex');

export const pinIsSet = () => load() !== null;

export function savePin(pin: string) {
	const salt = randomBytes(16).toString('hex');
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify({ salt, hash: hashPin(pin, salt) }) + '\n', { mode: 0o600 });
	renameSync(`${FILE}.tmp`, FILE);
}

/** 'ok' | 'wrong' (with tries left) | 'locked' (with seconds to wait) */
export function checkPin(pin: string): { ok: true } | { ok: false; triesLeft?: number; waitSeconds?: number } {
	const now = Date.now();
	if (now < lockedUntil) return { ok: false, waitSeconds: Math.ceil((lockedUntil - now) / 1000) };
	const saved = load();
	const good =
		!!saved && timingSafeEqual(Buffer.from(hashPin(pin, saved.salt), 'hex'), Buffer.from(saved.hash, 'hex'));
	if (good) {
		failures = 0;
		lockouts = 0;
		return { ok: true };
	}
	failures++;
	if (failures >= MAX_TRIES) {
		failures = 0;
		const ms = Math.min(MAX_LOCK_MS, LOCK_MS * 2 ** lockouts++);
		lockedUntil = now + ms;
		return { ok: false, waitSeconds: ms / 1000 };
	}
	return { ok: false, triesLeft: MAX_TRIES - failures };
}

export function startSession(cookies: Cookies) {
	const now = Date.now();
	for (const [t, expires] of sessions) if (expires < now) sessions.delete(t);
	const token = randomBytes(24).toString('hex');
	sessions.set(token, Date.now() + SESSION_MS);
	// plain http on the home network (a phone can open the admin tab too)
	cookies.set(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'strict', secure: false });
}

export function endSession(cookies: Cookies) {
	const token = cookies.get(COOKIE);
	if (token) sessions.delete(token);
	cookies.delete(COOKIE, { path: '/', secure: false });
}

/** Is this request from an unlocked admin tab? Refreshes the session. */
export function isAdmin(cookies: Cookies): boolean {
	const token = cookies.get(COOKIE);
	if (!token) return false;
	const expires = sessions.get(token);
	if (!expires || expires < Date.now()) {
		sessions.delete(token);
		return false;
	}
	sessions.set(token, Date.now() + SESSION_MS);
	return true;
}

/** The kiosk browser itself (the server and Chromium share the Pi). */
export const isLocal = (address: string) => /^(127\.|::1$|::ffff:127\.)/.test(address);

/** Throws 401 unless the request comes from an unlocked admin tab. */
export function requireAdmin(cookies: Cookies) {
	if (!isAdmin(cookies)) error(401, 'Grown-ups PIN needed');
}
