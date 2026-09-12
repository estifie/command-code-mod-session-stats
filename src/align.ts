import {stripAnsi} from './ansi.ts';

export type Align = 'left' | 'right';

/** Command Code renders a mod status segment with this much left padding. */
export const HOST_PADDING_LEFT = 2;

/** One spare column so a full-width line never wraps into a second row. */
export const SAFETY_MARGIN = 1;

/**
 * Visible width of a status line (ANSI SGR sequences do not occupy columns). Every glyph
 * this mod emits is single-width, so string length is exact here.
 */
export function visibleWidth(line: string): number {
	return stripAnsi(line).length;
}

/**
 * Right-align a status line by left-padding it with spaces.
 *
 * `cmd.ui.setStatus` renders its text verbatim in a single left-aligned row, and there is
 * no alignment option on the API — so pushing the text to the right edge is done with
 * leading spaces sized to the terminal. Returns the line unchanged when it cannot fit.
 */
export function alignLine(
	line: string,
	columns: number | undefined,
	align: Align = 'right',
	hostPadding: number = HOST_PADDING_LEFT,
	margin: number = SAFETY_MARGIN,
): string {
	if (align !== 'right' || !columns || columns <= 0) return line;
	const padding = columns - hostPadding - margin - visibleWidth(line);
	return padding > 0 ? ' '.repeat(padding) + line : line;
}
