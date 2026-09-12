import assert from 'node:assert/strict';
import {test} from 'node:test';
import {colors, paint, stripAnsi} from '../src/ansi.ts';
import {cacheTone, contextTone, formatPercent, formatTokens, formatUsd} from '../src/format.ts';

test('formatTokens compacts at k and M boundaries', () => {
	assert.equal(formatTokens(0), '0');
	assert.equal(formatTokens(940), '940');
	assert.equal(formatTokens(1_000), '1k');
	assert.equal(formatTokens(271_232), '271k');
	assert.equal(formatTokens(1_000_000), '1M');
	assert.equal(formatTokens(1_500_000), '1.5M');
	assert.equal(formatTokens(Number.NaN), '0');
});

test('formatUsd keeps useful precision at every scale', () => {
	assert.equal(formatUsd(0), '$0.00');
	assert.equal(formatUsd(2.5), '$2.50');
	assert.equal(formatUsd(0.524), '$0.524');
	assert.equal(formatUsd(0.001023), '$0.0010');
	assert.equal(formatUsd(0.0000023), '$0.000002');
});

test('formatPercent always has one decimal', () => {
	assert.equal(formatPercent(0), '0.0');
	assert.equal(formatPercent(27.24), '27.2');
	assert.equal(formatPercent(99.99), '100.0');
});

test('tones track context pressure and cache effectiveness', () => {
	assert.equal(contextTone(10), 'ok');
	assert.equal(contextTone(55), 'warn');
	assert.equal(contextTone(85), 'danger');
	assert.equal(cacheTone(null), 'muted');
	assert.equal(cacheTone(5), 'muted');
	assert.equal(cacheTone(30), 'warn');
	assert.equal(cacheTone(90), 'ok');
});

test('paint wraps and stripAnsi unwraps', () => {
	assert.equal(stripAnsi(paint('ok', '27.2%')), '27.2%');
	assert.equal(paint('danger', 'x'), `${colors.red}x${colors.reset}`);
});
