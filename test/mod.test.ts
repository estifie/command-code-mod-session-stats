import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, test} from 'node:test';
import {stripAnsi} from '../src/ansi.ts';
import {createMod, type ModApiLike, type ModEvent, type Timer} from '../src/mod.ts';

const root = mkdtempSync(join(tmpdir(), 'session-stats-mod-'));
after(() => rmSync(root, {recursive: true, force: true}));

const SESSION_ID = '11111111-2222-3333-4444-555555555555';
const sessionFile = join(root, 'proj-x', `${SESSION_ID}.jsonl`);
mkdirSync(join(root, 'proj-x'), {recursive: true});
writeFileSync(
	sessionFile,
	`${JSON.stringify({type: 'session', id: SESSION_ID, cwd: '/x'})}\n` +
		`${JSON.stringify({
			type: 'message',
			message: {role: 'assistant'},
			usage: {
				inputTokens: 271_813,
				outputTokens: 338,
				cacheReadTokens: 271_232,
				cacheWriteTokens: 0,
				costUsd: 0.524,
			},
			model: 'deepseek/deepseek-v4.1-flash',
		})}\n`,
);

interface Harness {
	cmd: ModApiLike;
	status: () => string | null;
	statusText: () => string | null;
	fire: (event: ModEvent) => void;
	spend: () => string;
}

function boot(options: {argv?: string[]; compact?: boolean} = {}): Harness {
	const handlers = new Map<string, Array<(event: ModEvent) => void>>();
	let status: string | null = null;
	let command: {handler: () => {message?: string}} | null = null;

	const cmd: ModApiLike = {
		ui: {setStatus: text => void (status = text)},
		session: {appendCustomEntry: () => undefined},
		on: (event, handler) => void handlers.set(event, [...(handlers.get(event) ?? []), handler]),
		hooks: () => undefined,
		addFlag: () => undefined,
		getFlag: name => (name === 'compact' ? options.compact === true : undefined),
		addCommand: input => void (command = input),
	};

	createMod({root, argv: options.argv ?? [], schedule: () => 0 as unknown as Timer})(cmd);

	return {
		cmd,
		status: () => status,
		statusText: () => (status == null ? null : stripAnsi(status)),
		fire: event => {
			for (const handler of handlers.get(event.type ?? '') ?? []) handler(event);
		},
		spend: () => command!.handler().message ?? '',
	};
}

test('renders nothing before a session has any data', () => {
	const h = boot();
	h.fire({type: 'session_start'});
	assert.equal(h.status(), null);
});

test('adopts the session from run_start and shows its committed totals', () => {
	const h = boot();
	h.fire({type: 'session_start'});
	h.fire({type: 'run_start', sessionId: SESSION_ID});

	const text = h.statusText();
	assert.ok(text?.includes('ctx 27.2%'), text ?? '');
	assert.ok(text?.includes('(272k/1M)'), text ?? '');
	assert.ok(text?.includes('cache 99.8%'), text ?? '');
	assert.ok(text?.includes('$0.524'), text ?? '');
});

test('live request usage overrides the committed one', () => {
	const h = boot();
	h.fire({type: 'run_start', sessionId: SESSION_ID});
	h.fire({
		type: 'model_request_end',
		model: 'deepseek/deepseek-v4.1-flash',
		usage: {inputTokens: 500_000, outputTokens: 100, cacheReadTokens: 400_000, cacheWriteTokens: 0},
	});

	const text = h.statusText();
	assert.ok(text?.includes('ctx 50.0%'), text ?? '');
	assert.ok(text?.includes('cache 80.0%'), text ?? '');
});

test('sub-agent tokens appear and are billed at the session blend', () => {
	const h = boot();
	h.fire({type: 'run_start', sessionId: SESSION_ID});
	h.fire({type: 'subagent_stop', tokensUsed: 42_000});

	const text = h.statusText();
	assert.ok(text?.includes('sub 42k'), text ?? '');
});

test('an explicit --resume id skips the probe', () => {
	const h = boot({argv: ['node', 'cmd', '--resume', SESSION_ID]});
	h.fire({type: 'session_start'});
	assert.ok(h.statusText()?.includes('$0.524'), h.statusText() ?? '');
});

test('compact mode drops the token pair and sub-agent count', () => {
	const h = boot({compact: true});
	h.fire({type: 'run_start', sessionId: SESSION_ID});
	h.fire({type: 'subagent_stop', tokensUsed: 42_000});

	const text = h.statusText();
	assert.ok(!text?.includes('(272k/1M)'), text ?? '');
	assert.ok(!text?.includes('sub'), text ?? '');
	assert.ok(text?.includes('$0.5'), text ?? '');
});

test('/spend reports the full breakdown', () => {
	const h = boot();
	h.fire({type: 'run_start', sessionId: SESSION_ID});
	h.fire({type: 'subagent_stop', tokensUsed: 42_000});

	const text = h.spend();
	assert.ok(text.startsWith('spend $0.5'), text);
	assert.ok(text.includes('cache hit 99.8%'), text);
	assert.ok(text.includes('sub-agents 42k tokens'), text);
});

test('session shutdown clears the footer', () => {
	const h = boot();
	h.fire({type: 'run_start', sessionId: SESSION_ID});
	assert.notEqual(h.status(), null);
	h.fire({type: 'session_shutdown'});
	assert.equal(h.status(), null);
});
