import assert from 'node:assert/strict';
import {test} from 'node:test';
import {alignLine, HOST_PADDING_LEFT, SAFETY_MARGIN, visibleWidth} from '../src/align.ts';
import {colors} from '../src/ansi.ts';

test('visibleWidth ignores ANSI escape sequences', () => {
	assert.equal(visibleWidth('abc'), 3);
	assert.equal(visibleWidth(`${colors.red}abc${colors.reset}`), 3);
	assert.equal(visibleWidth('ctx 27%'), 7);
});

test('alignLine pads to the right edge by default', () => {
	const columns = 80;
	const line = 'ctx 27.2% · $0.524';
	const padded = alignLine(line, columns);

	assert.equal(padded, ' '.repeat(columns - HOST_PADDING_LEFT - SAFETY_MARGIN - visibleWidth(line)) + line);
	assert.equal(visibleWidth(padded), columns - HOST_PADDING_LEFT - SAFETY_MARGIN);
	assert.ok(padded.endsWith(line));
});

test('alignLine leaves the line untouched when it cannot fit', () => {
	assert.equal(alignLine('a very long line', 10), 'a very long line');
});

test('alignLine is a no-op for left alignment or unknown width', () => {
	const line = 'ctx 27.2%';
	assert.equal(alignLine(line, 80, 'left'), line);
	assert.equal(alignLine(line, undefined), line);
	assert.equal(alignLine(line, 0), line);
});

test('alignLine respects custom padding and margin', () => {
	assert.equal(alignLine('ab', 10, 'right', 0, 0), ' '.repeat(8) + 'ab');
});
