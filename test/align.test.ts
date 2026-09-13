import assert from 'node:assert/strict';
import {test} from 'node:test';
import {alignLine, HOST_PADDING_LEFT, PAD_CHAR, SAFETY_MARGIN, visibleWidth} from '../src/align.ts';
import {colors} from '../src/ansi.ts';

test('visibleWidth ignores ANSI escape sequences', () => {
	assert.equal(visibleWidth('abc'), 3);
	assert.equal(visibleWidth(`${colors.red}abc${colors.reset}`), 3);
	assert.equal(visibleWidth('ctx 27%'), 7);
});

test('alignLine is a no-op by default', () => {
	assert.equal(alignLine('ctx 27.2% · $0.524', 80), 'ctx 27.2% · $0.524');
});

test('alignLine pads to the right edge when asked', () => {
	const columns = 80;
	const line = 'ctx 27.2% · $0.524';
	const padded = alignLine(line, columns, 'right');

	assert.equal(padded, PAD_CHAR.repeat(columns - HOST_PADDING_LEFT - SAFETY_MARGIN - visibleWidth(line)) + line);
	assert.equal(visibleWidth(padded), columns - HOST_PADDING_LEFT - SAFETY_MARGIN);
	assert.ok(padded.endsWith(line));
});

test('alignLine leaves the line untouched when it cannot fit', () => {
	assert.equal(alignLine('a very long line', 10, 'right'), 'a very long line');
});

test('alignLine is a no-op for left alignment or unknown width', () => {
	const line = 'ctx 27.2%';
	assert.equal(alignLine(line, 80, 'left'), line);
	assert.equal(alignLine(line, 80), line);
	assert.equal(alignLine(line, undefined, 'right'), line);
	assert.equal(alignLine(line, 0, 'right'), line);
});

test('alignLine respects custom padding and margin', () => {
	assert.equal(alignLine('ab', 10, 'right', 0, 0), PAD_CHAR.repeat(8) + 'ab');
});

test('padded lines survive the host status sanitizer', () => {
	// The host runs replace(/ +/g, ' ').trim() over a status segment before rendering it,
	// which is why the padding is not made of ordinary spaces.
	const sanitize = (text: string): string =>
		text.replace(/[\r\n\t]/g, ' ').replace(/ +/g, ' ').trim();
	const padded = alignLine('ctx 27% · $0.524', 80, 'right');
	assert.equal(sanitize(padded), padded);
	assert.ok(sanitize(' '.repeat(20) + 'ctx'), 'ordinary spaces would not survive');
});
