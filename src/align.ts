import {stripAnsi} from './ansi.ts';

export type Align = 'left' | 'right';

/** Command Code renders a mod status segment with this much left padding. */
export const HOST_PADDING_LEFT = 2;

/** Spare columns kept between the text and the terminal's right edge. */
export const SAFETY_MARGIN = 2;

/**
 * Invisible, single-column pad character.
 *
 * The host sanitises a status segment with `replace(/ +/g, ' ').trim()`, which would erase
 * any padding made of ordinary spaces. U+2800 BRAILLE PATTERN BLANK is not ASCII whitespace,
 * so it survives that pass, and it measures exactly one column wide — the standard blank
 * spacer for line-based TUIs.
 */
export const PAD_CHAR = '\u2800';

/**
 * Visible width of a status line (ANSI SGR sequences do not occupy columns). Every glyph
 * this mod emits is single-width, so string length is exact here.
 */
export function visibleWidth(line: string): number {
	return stripAnsi(line).length;
}

/**
 * Optionally right-align a status line by padding it out to the terminal width.
 *
 * `cmd.ui.setStatus` renders its text verbatim in a single left-aligned row, and there is no
 * alignment option on the API, so pushing the text to the right edge has to be done by hand.
 * Left alignment is the default and is a no-op; `align=right` opts in. Returns the line
 * unchanged when it cannot fit.
 */
export function alignLine(
	line: string,
	columns: number | undefined,
	align: Align = 'left',
	hostPadding: number = HOST_PADDING_LEFT,
	margin: number = SAFETY_MARGIN,
): string {
	if (align !== 'right' || !columns || columns <= 0) return line;
	const padding = columns - hostPadding - margin - visibleWidth(line);
	return padding > 0 ? PAD_CHAR.repeat(padding) + line : line;
}
