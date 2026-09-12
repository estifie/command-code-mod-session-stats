import {closeSync, openSync, readdirSync, readSync, statSync} from 'node:fs';
import {join} from 'node:path';

/** `~/.commandcode/projects` — the root every session transcript lives under. */
export function projectsRoot(home: string): string {
	return join(home, '.commandcode', 'projects');
}

/** A transcript is `<uuid>.jsonl`; checkpoint sidecars are not transcripts. */
export function isTranscriptFile(name: string): boolean {
	return name.endsWith('.jsonl') && !name.endsWith('.checkpoints.jsonl');
}

/** Every project directory under the projects root (best-effort). */
export function projectDirs(root: string): string[] {
	try {
		return readdirSync(root).map(name => join(root, name));
	} catch {
		return [];
	}
}

/** Find `<sessionId>.jsonl` across every project directory. */
export function findBySessionId(root: string, sessionId: string): string | null {
	const target = `${sessionId}.jsonl`;
	for (const dir of projectDirs(root)) {
		const candidate = join(dir, target);
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			// not in this project dir
		}
	}
	return null;
}

function readTail(path: string, bytes: number): string {
	try {
		const size = statSync(path).size;
		const length = Math.min(bytes, size);
		const buffer = Buffer.allocUnsafe(length);
		const fd = openSync(path, 'r');
		try {
			readSync(fd, buffer, 0, length, size - length);
		} finally {
			closeSync(fd);
		}
		return buffer.toString('utf8');
	} catch {
		return '';
	}
}

interface RecentTranscript {
	path: string;
	mtimeMs: number;
}

function recentTranscripts(root: string, freshMs: number): RecentTranscript[] {
	const now = Date.now();
	const found: RecentTranscript[] = [];
	for (const dir of projectDirs(root)) {
		let names: string[];
		try {
			names = readdirSync(dir);
		} catch {
			continue;
		}
		for (const name of names) {
			if (!isTranscriptFile(name)) continue;
			const path = join(dir, name);
			try {
				const stat = statSync(path);
				if (now - stat.mtimeMs <= freshMs) found.push({path, mtimeMs: stat.mtimeMs});
			} catch {
				// raced with a delete
			}
		}
	}
	return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Find the transcript that contains `nonce`, among files written within `freshMs`.
 *
 * Command Code does not hand a mod the id of the session it is bound to, so the mod
 * appends a one-off `custom` entry through the public session API and looks for it on
 * disk. Only the active transcript was just written, so this is both exact and cheap.
 */
export function findFileContainingNonce(
	root: string,
	nonce: string,
	options: {freshMs?: number; tailBytes?: number} = {},
): string | null {
	const freshMs = options.freshMs ?? 60_000;
	const tailBytes = options.tailBytes ?? 8192;
	for (const {path} of recentTranscripts(root, freshMs)) {
		if (readTail(path, tailBytes).includes(nonce)) return path;
	}
	return null;
}

/** Newest transcript written within `freshMs`, or null. */
export function findNewestTranscript(root: string, freshMs = 60_000): string | null {
	return recentTranscripts(root, freshMs)[0]?.path ?? null;
}

/** Session id encoded in a transcript path (`…/‹id›.jsonl`), or null. */
export function sessionIdFromPath(path: string): string | null {
	const name = path.slice(path.lastIndexOf('/') + 1);
	if (!isTranscriptFile(name)) return null;
	return name.slice(0, -'.jsonl'.length);
}
