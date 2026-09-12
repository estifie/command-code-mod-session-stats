import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {colors, paint} from './ansi.ts';
import {sessionIdFromArgv} from './argv.ts';
import {contextLimitFor} from './context-windows.ts';
import {cacheTone, contextTone, formatPercent, formatTokens, formatUsd} from './format.ts';
import {SessionLog} from './session-log.ts';
import {findBySessionId, findFileContainingNonce, projectsRoot} from './session-finder.ts';
import type {Usage} from './types.ts';

/** Custom entry type used to fingerprint the active transcript on disk. */
const PROBE_TYPE = 'session-stats/probe';
const PROBE_ATTEMPTS = 6;
const PROBE_FRESH_MS = 60_000;

export type Timer = ReturnType<typeof setTimeout>;

/** The slice of `ModApi` this mod uses — kept structural so it is trivially mockable. */
export interface ModUi {
	setStatus(text: string | null): unknown;
	notify?(message: string, level?: 'info' | 'warning' | 'error'): unknown;
	capabilities?: {status?: boolean};
}

export interface ModSessionApi {
	appendCustomEntry(input: {customType: string; data?: unknown}): unknown;
}

export interface ModEvent {
	type?: string;
	sessionId?: string;
	model?: string;
	usage?: Usage;
	tokensUsed?: number;
}

export interface ModApiLike {
	name?: string;
	cwd?: string;
	ui: ModUi;
	session?: ModSessionApi;
	on(event: string, handler: (event: ModEvent) => void): unknown;
	hooks(hooks: {onSessionEnd?: (input: {reason: string}) => void}): unknown;
	addFlag(
		name: string,
		options: {type: 'boolean' | 'string'; default?: unknown; description?: string},
	): unknown;
	getFlag(name: string): unknown;
	addCommand(input: {
		name: string;
		description?: string;
		handler: () => {message?: string};
	}): unknown;
}

export interface ModDeps {
	/** Projects root override (tests). Defaults to `~/.commandcode/projects`. */
	root?: string;
	/** Argument list override (tests). Defaults to `process.argv`. */
	argv?: readonly string[];
	/** Timer override (tests). Defaults to `setTimeout`. */
	schedule?: (fn: () => void, ms: number) => Timer;
}

/**
 * Build the session-stats mod.
 *
 * Two independent sources feed the footer:
 *  - the session transcript on disk — exact, model-priced totals for the whole chat, and
 *    the last committed request's usage (so a resumed chat shows its numbers immediately);
 *  - the live event stream — the in-flight request's usage, which updates before the
 *    transcript is committed, plus sub-agent tokens, which are never persisted at all.
 */
export function createMod(deps: ModDeps = {}) {
	const root = deps.root ?? projectsRoot(homedir());
	const argv = deps.argv ?? process.argv;
	const schedule = deps.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

	return function sessionStats(cmd: ModApiLike): void {
		const log = new SessionLog();
		let liveUsage: Usage | null = null;
		let liveModel: string | null = null;
		let subagentTokens = 0;
		let timers: Timer[] = [];

		const clearTimers = (): void => {
			for (const timer of timers) clearTimeout(timer);
			timers = [];
		};

		const ingest = (): boolean => log.readNew();

		const adopt = (path: string | null): boolean => {
			if (!path) return false;
			log.setPath(path);
			ingest();
			return true;
		};

		const resolveFromSessionId = (sessionId: string | null): boolean =>
			sessionId ? adopt(findBySessionId(root, sessionId)) : false;

		/**
		 * The mod is never told which session it is bound to, so on a resumed session we
		 * write a throwaway `custom` entry and then find the transcript that received it.
		 * A brand-new session has nothing to read yet anyway, and resolves via `run_start`.
		 */
		const probeForActiveFile = (): void => {
			if (!cmd.session?.appendCustomEntry) return;
			const nonce = randomUUID();
			try {
				cmd.session.appendCustomEntry({customType: PROBE_TYPE, data: {nonce, at: Date.now()}});
			} catch {
				return;
			}
			let attempt = 0;
			const tick = (): void => {
				attempt += 1;
				const file = findFileContainingNonce(root, nonce, {freshMs: PROBE_FRESH_MS});
				if (file && adopt(file)) {
					render();
					return;
				}
				if (attempt < PROBE_ATTEMPTS) timers.push(schedule(tick, 150 * attempt));
			};
			timers.push(schedule(tick, 120));
		};

		const currentUsage = (): Usage | null => liveUsage ?? log.lastUsage;
		const currentModel = (): string | null => liveModel ?? log.lastModel;
		const isCompact = (): boolean => cmd.getFlag('compact') === true;

		function render(): void {
			const usage = currentUsage();
			if (!usage && !log.path) {
				cmd.ui.setStatus(null);
				return;
			}

			const limit = contextLimitFor(currentModel());
			const used = usage ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) : 0;
			const percent = limit > 0 ? (used / limit) * 100 : 0;
			const input = usage?.inputTokens ?? 0;
			const cacheRate = usage && input > 0 ? ((usage.cacheReadTokens ?? 0) / input) * 100 : null;
			const cost = log.costUsd + subagentTokens * log.blendedRate();
			const compact = isCompact();
			const separator = `${colors.dim} · ${colors.reset}`;

			const parts: string[] = [
				usage
					? `${colors.dim}ctx${colors.reset} ${paint(contextTone(percent), `${formatPercent(percent)}%`)}` +
						(compact
							? ''
							: ` ${colors.dim}(${formatTokens(used)}/${formatTokens(limit)})${colors.reset}`)
					: `${colors.dim}ctx –${colors.reset}`,
				cacheRate == null
					? `${colors.dim}cache –${colors.reset}`
					: `${colors.dim}cache${colors.reset} ${paint(cacheTone(cacheRate), `${formatPercent(cacheRate)}%`)}`,
				log.costAvailable
					? `${colors.dim}$${colors.reset}${colors.cyan}${formatUsd(cost).slice(1)}${colors.reset}`
					: `${colors.dim}cost –${colors.reset}`,
			];
			if (!compact && subagentTokens > 0) {
				parts.push(
					`${colors.dim}sub${colors.reset} ${colors.dim}${formatTokens(subagentTokens)}${colors.reset}`,
				);
			}

			cmd.ui.setStatus(parts.join(separator));
		}

		function detail(): string {
			const usage = currentUsage();
			const limit = contextLimitFor(currentModel());
			const used = usage ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) : 0;
			const input = usage?.inputTokens ?? 0;
			const cacheRate = input > 0 ? ((usage?.cacheReadTokens ?? 0) / input) * 100 : null;
			const subagentCost = subagentTokens * log.blendedRate();
			const cachedInput = log.totals.cacheRead + log.totals.cacheWrite;

			const parts: string[] = [
				log.costAvailable ? `spend ${formatUsd(log.costUsd + subagentCost)}` : 'spend n/a',
				`in ${formatTokens(log.totals.input)} (cache ${formatTokens(cachedInput)})`,
				`out ${formatTokens(log.totals.output)}`,
				`cache hit ${cacheRate == null ? '–' : `${formatPercent(cacheRate)}%`}`,
				`ctx ${formatTokens(used)}/${formatTokens(limit)} (${formatPercent((used / limit) * 100)}%)`,
			];
			if (subagentTokens > 0) {
				parts.push(`sub-agents ${formatTokens(subagentTokens)} tokens (~${formatUsd(subagentCost)} est.)`);
			}
			if (!log.path) parts.push('session log not located yet');
			else if (!log.costAvailable && log.usageMessages > 0) {
				parts.push('model not priced by the CLI — cost unavailable');
			}
			return parts.join(' · ');
		}

		cmd.on('session_start', () => {
			clearTimers();
			log.setPath(null);
			liveUsage = null;
			liveModel = null;
			subagentTokens = 0;

			if (resolveFromSessionId(sessionIdFromArgv(argv))) {
				render();
				return;
			}
			render();
			probeForActiveFile();
		});

		cmd.on('session_shutdown', () => {
			clearTimers();
			log.setPath(null);
			cmd.ui.setStatus(null);
		});

		cmd.on('run_start', event => {
			if (event.type !== 'run_start') return;
			liveUsage = null;
			liveModel = null;
			if (!resolveFromSessionId(event.sessionId ?? null)) ingest();
			render();
		});

		cmd.on('model_request_end', event => {
			if (event.type !== 'model_request_end') return;
			if (event.model) liveModel = event.model;
			liveUsage = event.usage ?? null;
			render();
		});

		cmd.on('subagent_stop', event => {
			if (event.type !== 'subagent_stop') return;
			subagentTokens += event.tokensUsed ?? 0;
			render();
		});

		cmd.on('turn_end', () => {
			ingest();
			render();
		});

		cmd.on('run_end', () => {
			ingest();
			render();
		});

		cmd.hooks({
			onSessionEnd: () => {
				clearTimers();
				cmd.ui.setStatus(null);
			},
		});

		cmd.addFlag('compact', {
			type: 'boolean',
			default: false,
			description: 'Drop the token pair and sub-agent count from the footer',
		});

		cmd.addCommand({
			name: 'spend',
			description: "Show this session's tokens, cache-hit rate and total cost",
			handler: () => {
				ingest();
				return {message: detail()};
			},
		});
	};
}
