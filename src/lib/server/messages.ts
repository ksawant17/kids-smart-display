/**
 * Grown-up notes for the TODAY banner, kept in data/messages.json
 * (git-ignored; old ones are dropped once their last day has passed).
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { keyOf } from '#lib/utils/schoolCalendar';
import type { ParentMessage } from '#lib/utils/messages';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'messages.json');
const MAX_MESSAGES = 20;

function load(): ParentMessage[] {
	try {
		const list = JSON.parse(readFileSync(FILE, 'utf8'));
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

function save(list: ParentMessage[]) {
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify(list, null, '\t') + '\n');
	renameSync(`${FILE}.tmp`, FILE);
}

/** every message that still has a day to show (yesterday's are gone) */
export function listMessages(): ParentMessage[] {
	// a day of slack, so a phone in another time zone never loses "today"
	const y = new Date();
	y.setDate(y.getDate() - 1);
	const cutoff = keyOf(y);
	return load().filter((m) => m.until === null || m.until >= cutoff);
}

export function addMessage(m: Omit<ParentMessage, 'id'>): ParentMessage[] {
	const list = listMessages();
	list.push({ id: randomBytes(6).toString('hex'), ...m });
	save(list.slice(-MAX_MESSAGES));
	return listMessages();
}

export function removeMessage(id: string): ParentMessage[] {
	save(listMessages().filter((m) => m.id !== id));
	return listMessages();
}
