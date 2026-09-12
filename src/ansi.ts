const ESC = '\u001b[';

export const colors = {
	reset: `${ESC}0m`,
	dim: `${ESC}2m`,
	bold: `${ESC}1m`,
	red: `${ESC}31m`,
	green: `${ESC}32m`,
	yellow: `${ESC}33m`,
	cyan: `${ESC}36m`,
} as const;

export type Tone = 'ok' | 'warn' | 'danger' | 'muted';

const TONE_COLORS: Record<Tone, string> = {
	ok: colors.green,
	warn: colors.yellow,
	danger: colors.red,
	muted: colors.dim,
};

/** Wrap `text` in the color for `tone`. */
export function paint(tone: Tone, text: string): string {
	return `${TONE_COLORS[tone]}${text}${colors.reset}`;
}

/** Strip ANSI SGR sequences — used by tests and by any consumer that needs raw text. */
export function stripAnsi(text: string): string {
	return text.replace(/\u001b\[[0-9;]*m/g, '');
}
