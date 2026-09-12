import assert from 'node:assert/strict';
import {appendFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, test} from 'node:test';
import {SessionLog, readSessionLog} from '../src/session-log.ts';

const dir = mkdtempSync(join(tmpdir(), 'session-stats-log-'));
after(() => rmSync(dir, {recursive: true, force: true}));

let counter = 0;
function tempFile(): string {
	counter += 1;
	return join(dir, `log-${counter}.jsonl`);
}

function entry(usage: Record<string, unknown>, model = 'deepseek/deepseek-v4.1-flash'): string {
	return `${JSON.stringify({type: 'message', message: {role: 'assistant'}, usage, model})}\n`;
}

test('folds usage from every entry into session totals', () => {
	const path = tempFile();
	writeFileSync(
		path,
		`${JSON.stringify({type: 'session', id: 's-1', cwd: '/x'})}\n` +
			entry({
				inputTokens: 100,
				outputTokens: 10,
				cacheReadTokens: 80,
				cacheWriteTokens: 0,
				costUsd: 0.0001,
			}) +
			`${JSON.stringify({type: 'message', message: {role: 'user'}})}\n` +
			entry({inputTokens: 200, outputTokens: 20, cacheReadTokens: 180, cacheWriteTokens: 0, costUsd: 0.0002}, 'm-2'),
	);

	const log = readSessionLog(path);
	assert.deepEqual(log.totals, {input: 300, output: 30, cacheRead: 260, cacheWrite: 0});
	assert.equal(log.costUsd.toFixed(4), '0.0003');
	assert.equal(log.usageMessages, 2);
	assert.equal(log.pricedMessages, 2);
	assert.equal(log.costAvailable, true);
	assert.equal(log.lastModel, 'm-2');
	assert.equal(log.lastUsage?.inputTokens, 200);
	assert.ok(log.blendedRate() > 0);
});

test('reads only what was appended since the last call', () => {
	const path = tempFile();
	writeFileSync(path, entry({inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0}));

	const log = new SessionLog();
	log.setPath(path);
	assert.equal(log.readNew(), true);
	assert.equal(log.readNew(), false, 'no new bytes, no change');
	assert.equal(log.totals.input, 100);

	appendFileSync(path, entry({inputTokens: 50, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0}));
	assert.equal(log.readNew(), true);
	assert.equal(log.totals.input, 150);
	assert.equal(log.totals.output, 15);
});

test('holds back a partial trailing line until it is complete', () => {
	const path = tempFile();
	writeFileSync(path, '');

	const log = new SessionLog();
	log.setPath(path);

	const line = entry({inputTokens: 40, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0});
	appendFileSync(path, line.trimEnd());
	assert.equal(log.readNew(), false, 'no newline yet');
	assert.equal(log.totals.input, 0);

	appendFileSync(path, '\n');
	assert.equal(log.readNew(), true);
	assert.equal(log.totals.input, 40);
});

test('starts over when the file is truncated', () => {
	const path = tempFile();
	writeFileSync(path, entry({inputTokens: 500, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0}));

	const log = readSessionLog(path);
	assert.equal(log.totals.input, 500);

	writeFileSync(path, entry({inputTokens: 7, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0}));
	log.readNew();
	assert.equal(log.totals.input, 7);
	assert.equal(log.totals.output, 1);
});

test('unpriced entries still count tokens but leave cost unavailable', () => {
	const path = tempFile();
	writeFileSync(path, entry({inputTokens: 900, outputTokens: 90, cacheReadTokens: 0, cacheWriteTokens: 0}));

	const log = readSessionLog(path);
	assert.equal(log.usageMessages, 1);
	assert.equal(log.pricedMessages, 0);
	assert.equal(log.costAvailable, false);
	assert.equal(log.blendedRate(), 0);
});

test('resetting the path clears accumulated state', () => {
	const path = tempFile();
	writeFileSync(path, entry({inputTokens: 10, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0}));
	const log = readSessionLog(path);
	assert.equal(log.totals.input, 10);

	log.setPath(join(dir, 'other.jsonl'));
	assert.equal(log.totals.input, 0);
	assert.equal(log.costAvailable, false);
	assert.equal(log.path, join(dir, 'other.jsonl'));
});
