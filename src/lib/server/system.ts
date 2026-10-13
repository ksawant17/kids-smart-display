/**
 * The Pi itself, for the admin tab: power (restart / power off), the clock
 * (time zone, automatic time, setting it by hand) and a few health numbers.
 *
 * Also Wi-Fi (NetworkManager's nmcli) and software updates (git + rebuild).
 *
 * Power, clock and Wi-Fi changes go through systemd / NetworkManager, which
 * ask polkit. The server runs as a plain user, so they only work once
 * system/polkit/50-kids-smart-dashboard.rules is installed (see README);
 * `permissions()` tells the page whether that has been done.
 *
 * ADMIN_DRY_RUN=1 logs the commands instead of running them (dev / testing).
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { hostname, networkInterfaces, uptime } from 'node:os';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
	parseTimedate,
	parseWifiList,
	splitTerse,
	type TimeStatus,
	type UpdateInfo,
	type WifiNetwork
} from '#lib/utils/admin';

const run = promisify(execFile);
const DRY_RUN = process.env.ADMIN_DRY_RUN === '1';

async function exec(cmd: string, args: string[], timeout = 10_000): Promise<string> {
	const { stdout } = await run(cmd, args, { timeout });
	return stdout;
}

/** Commands that change the Pi: only logged in dry-run mode. */
async function change(cmd: string, args: string[]) {
	if (DRY_RUN) {
		console.log(`[admin] dry run: ${cmd} ${args.join(' ')}`);
		return;
	}
	try {
		await exec(cmd, args);
	} catch (err) {
		const msg = (err as { stderr?: string }).stderr?.trim() || String(err);
		throw new Error(msg);
	}
}

/** Would polkit let this process do `actionId` without a password? */
async function allowed(actionId: string): Promise<boolean> {
	if (DRY_RUN) return true;
	try {
		await exec('pkcheck', ['--action-id', actionId, '--process', String(process.pid)]);
		return true;
	} catch {
		return false;
	}
}

export interface Permissions {
	power: boolean;
	clock: boolean;
	wifi: boolean;
}

export async function permissions(): Promise<Permissions> {
	const [power, clock, wifi] = await Promise.all([
		allowed('org.freedesktop.login1.power-off'),
		allowed('org.freedesktop.timedate1.set-timezone'),
		allowed('org.freedesktop.NetworkManager.network-control')
	]);
	return { power, clock, wifi };
}

/* ------------------------------- power ------------------------------- */

/** Restart or power off, a moment from now (so the page can say goodbye first). */
export function power(action: 'reboot' | 'poweroff') {
	setTimeout(() => {
		change('systemctl', [action]).catch((err) => console.warn(`[admin] ${action} failed: ${err}`));
	}, 1500);
}

/** Restart the kiosk browser (e.g. so it picks up a new time zone). */
export async function restartKiosk() {
	try {
		const pid = Number((await exec('systemctl', ['show', 'kids-smart-kiosk', '-p', 'MainPID', '--value'])).trim());
		// the unit runs as this same user and has Restart=always
		if (pid > 0) {
			if (DRY_RUN) console.log(`[admin] dry run: kill ${pid} (kiosk)`);
			else process.kill(pid);
		}
	} catch {
		/* no kiosk unit (dev machine) */
	}
}

/* ------------------------------- clock ------------------------------- */

export async function timeStatus(): Promise<TimeStatus> {
	try {
		return parseTimedate(await exec('timedatectl', ['show']));
	} catch {
		return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ntp: true, synced: false };
	}
}

export async function setTimezone(tz: string) {
	await change('timedatectl', ['set-timezone', tz]);
	// Node keeps the zone it started with unless TZ is set
	process.env.TZ = tz;
}

export const setNtp = (on: boolean) => change('timedatectl', ['set-ntp', on ? 'true' : 'false']);

/** "YYYY-MM-DD HH:MM" local; only allowed while automatic time is off. */
export const setTime = (local: string) => change('timedatectl', ['set-time', `${local}:00`]);

/* ------------------------------- health ------------------------------ */

export interface SystemInfo {
	hostname: string;
	ip: string[];
	uptimeSeconds: number;
	/** CPU temperature, °C */
	tempC: number | null;
	/** free space on the SD card, GB */
	diskFreeGb: number | null;
	wifi: string | null;
}


export async function systemInfo(): Promise<SystemInfo> {
	let tempC: number | null = null;
	try {
		tempC = Math.round(Number(readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000);
	} catch {
		/* not a Pi */
	}
	let diskFreeGb: number | null = null;
	try {
		const fs = statfsSync('/');
		diskFreeGb = Math.round(((fs.bavail * fs.bsize) / 1e9) * 10) / 10;
	} catch {
		/* unsupported */
	}
	const ip = Object.values(networkInterfaces())
		.flat()
		.filter((a) => a && a.family === 'IPv4' && !a.internal)
		.map((a) => a!.address);
	return { hostname: hostname(), ip, uptimeSeconds: Math.round(uptime()), tempC, diskFreeGb, wifi: await wifiName() };
}

/* -------------------------------- Wi-Fi ------------------------------- */

/** nearby networks, the one in use first; `rescan` asks the radio to look again */
export async function wifiNetworks(rescan = false): Promise<WifiNetwork[]> {
	try {
		const out = await exec(
			'nmcli',
			['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', rescan ? 'yes' : 'auto'],
			20_000
		);
		return parseWifiList(out);
	} catch (err) {
		console.warn(`[admin] wifi list failed: ${err}`);
		return [];
	}
}

/** Join a network (NetworkManager remembers it). Throws with nmcli's reason. */
export async function connectWifi(ssid: string, password?: string) {
	if (DRY_RUN) {
		console.log(`[admin] dry run: nmcli dev wifi connect ${JSON.stringify(ssid)}${password ? ' password ***' : ''}`);
		return;
	}
	const args = ['--wait', '30', 'dev', 'wifi', 'connect', ssid];
	if (password) args.push('password', password);
	try {
		await exec('nmcli', args, 40_000);
	} catch (err) {
		const msg = ((err as { stderr?: string }).stderr ?? '').trim();
		throw new Error(
			/secrets|password|802-1x|psk/i.test(msg) ? 'Wrong password?' : msg.replace(/^Error:\s*/, '') || String(err)
		);
	}
}

/** the network the Pi is on right now (null: none / no Wi-Fi) */
async function wifiName(): Promise<string | null> {
	try {
		const out = await exec('nmcli', ['-t', '-f', 'active,ssid', 'dev', 'wifi']);
		const line = out.split('\n').find((l) => l.startsWith('yes:'));
		return line ? splitTerse(line)[1] || null : null;
	} catch {
		return null;
	}
}

/* ------------------------------- updates ------------------------------ */

const DATA = resolve(process.env.DASHBOARD_DATA ?? 'data');
const UPDATE_LOG = resolve(DATA, 'update.log');
const UPDATE_LOCK = resolve(DATA, 'update.lock');


const git = (args: string[], timeout?: number) => exec('git', args, timeout).then((s) => s.trim());

function updateRunning(): boolean {
	try {
		process.kill(Number(readFileSync(UPDATE_LOCK, 'utf8')), 0);
		return true;
	} catch {
		return false;
	}
}

function updateLog(): string[] {
	try {
		return readFileSync(UPDATE_LOG, 'utf8').trimEnd().split('\n').slice(-8);
	} catch {
		return [];
	}
}

/** what's installed and what's new; `fetch` checks GitHub first */
export async function updateInfo(fetch = false): Promise<UpdateInfo> {
	const [version, date, subject] = (await git(['log', '-1', '--format=%h%x1f%cs%x1f%s'])).split('\x1f');
	let behind: number | null = null;
	let waiting: string[] = [];
	try {
		if (fetch) await git(['fetch', '--quiet'], 30_000);
		behind = Number(await git(['rev-list', '--count', 'HEAD..@{u}']));
		waiting = behind ? (await git(['log', '--format=%s', '-n', '8', 'HEAD..@{u}'])).split('\n') : [];
	} catch (err) {
		console.warn(`[admin] update check failed: ${err}`);
	}
	const localChanges = (await git(['status', '--porcelain', '--untracked-files=no'])) !== '';
	return { version, date, subject, behind, waiting, localChanges, running: updateRunning(), log: updateLog() };
}

/**
 * Start scripts/update.sh in the background: pull, build next to the running
 * copy, swap, restart this server (systemd brings it back; the kiosk page
 * notices the new version and reloads itself).
 */
export function startUpdate() {
	if (updateRunning()) throw new Error('An update is already running');
	mkdirSync(dirname(UPDATE_LOG), { recursive: true });
	if (DRY_RUN) {
		writeFileSync(UPDATE_LOG, '== dry run: would run scripts/update.sh\nDONE: nothing changed (dry run)\n');
		return;
	}
	const script = resolve('scripts/update.sh');
	if (!existsSync(script)) throw new Error('scripts/update.sh is missing');
	const log = openSync(UPDATE_LOG, 'w');
	const child = spawn('bash', [script], {
		detached: true,
		stdio: ['ignore', log, log],
		// npm needs the same node that runs this server
		env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`, DASHBOARD_DATA: DATA }
	});
	child.unref();
}
