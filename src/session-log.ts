import {closeSync, openSync, readSync, statSync} from 'node:fs';
import type {SessionEntry, Usage} from './types.ts';

export interface SessionTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

function emptyTotals(): SessionTotals {
	return {input: 0, output: 0, cacheRead: 0, cacheWrite: 0};
}

function parseLine(line: string): SessionEntry | null {
	try {
		return JSON.parse(line) as SessionEntry;
	} catch {
		return null;
	}
}

/**
 * An incremental reader over one Command Code session transcript (`<session>.jsonl`).
 *
 * The transcript is append-only, so the reader remembers how many bytes it has consumed
 * and only parses what was appended since — cheap even for multi-hundred-MB sessions.
 * Totals cover every priced/usage-bearing entry in the file, including abandoned branches,
 * which is exactly what the chat cost in total.
 */
export class SessionLog {
	path: string | null = null;
	offset = 0;
	private carry = '';

	totals: SessionTotals = emptyTotals();
	costUsd = 0;
	/** Entries in the transcript that carried a usage block. */
	usageMessages = 0;
	/** Entries that carried a priced usage block (`costUsd`). */
	pricedMessages = 0;
	/** Usage of the most recently committed request in the file. */
	lastUsage: Usage | null = null;
	/** Model of the most recently committed request in the file. */
	lastModel: string | null = null;

	/** Point at a transcript. Resets everything when the path actually changes. */
	setPath(path: string | null): void {
		if (path === this.path) return;
		this.path = path;
		this.reset();
	}

	/** Drop all accumulated state (keeps the current path). */
	reset(): void {
		this.offset = 0;
		this.carry = '';
		this.totals = emptyTotals();
		this.costUsd = 0;
		this.usageMessages = 0;
		this.pricedMessages = 0;
		this.lastUsage = null;
		this.lastModel = null;
	}

	/** Read and fold in anything appended since the last call. Returns true if it changed. */
	readNew(): boolean {
		const path = this.path;
		if (!path) return false;

		let size: number;
		try {
			size = statSync(path).size;
		} catch {
			return false;
		}

		// A shrunk file was rewritten/truncated — start over.
		if (size < this.offset) {
			this.reset();
		}
		if (size === this.offset) return false;

		let text: string;
		try {
			const length = size - this.offset;
			const buffer = Buffer.allocUnsafe(length);
			const fd = openSync(path, 'r');
			try {
				readSync(fd, buffer, 0, length, this.offset);
			} finally {
				closeSync(fd);
			}
			this.offset = size;
			text = this.carry + buffer.toString('utf8');
		} catch {
			return false;
		}

		// Hold back a trailing partial line until the rest arrives.
		const newline = text.lastIndexOf('\n');
		this.carry = newline >= 0 ? text.slice(newline + 1) : text;
		const chunk = newline >= 0 ? text.slice(0, newline) : '';
		if (!chunk) return false;

		let changed = false;
		for (const line of chunk.split('\n')) {
			if (!line.includes('"usage"')) continue;
			const entry = parseLine(line);
			const usage = entry?.usage;
			if (!usage || typeof usage.inputTokens !== 'number') continue;

			this.usageMessages += 1;
			this.totals.input += usage.inputTokens;
			this.totals.output += usage.outputTokens ?? 0;
			this.totals.cacheRead += usage.cacheReadTokens ?? 0;
			this.totals.cacheWrite += usage.cacheWriteTokens ?? 0;
			if (typeof usage.costUsd === 'number') {
				this.costUsd += usage.costUsd;
				this.pricedMessages += 1;
			}
			this.lastUsage = usage;
			if (entry?.model) this.lastModel = entry.model;
			changed = true;
		}
		return changed;
	}

	/** Every token the session has moved (cached input counts once). */
	totalTokens(): number {
		return this.totals.input + this.totals.output + this.totals.cacheRead + this.totals.cacheWrite;
	}

	/**
	 * Effective dollars-per-token for this session, used to estimate sub-agent spend
	 * (sub-agent runs are never persisted, so only their token count reaches us).
	 */
	blendedRate(): number {
		const tokens = this.totalTokens();
		if (this.pricedMessages === 0 || tokens <= 0) return 0;
		return this.costUsd / tokens;
	}

	/** True once the file has at least one priced entry. */
	get costAvailable(): boolean {
		return this.pricedMessages > 0;
	}
}

/** Convenience: read a whole transcript file once, synchronously. Used by tests. */
export function readSessionLog(path: string): SessionLog {
	const log = new SessionLog();
	log.setPath(path);
	log.readNew();
	return log;
}
