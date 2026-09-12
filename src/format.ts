import type {Tone} from './ansi.ts';

/** Compact token counts: `940`, `12k`, `1.5M`. */
export function formatTokens(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '0';
	if (value >= 1_000_000) {
		const millions = value / 1_000_000;
		return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
	}
	if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
	return String(Math.round(value));
}

/** Dollar amounts with just enough precision to stay readable at any scale. */
export function formatUsd(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '$0.00';
	if (value >= 1) return `$${value.toFixed(2)}`;
	if (value >= 0.01) return `$${value.toFixed(3)}`;
	if (value >= 0.0001) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(6)}`;
}

/** One decimal place, no percent sign (callers add it). */
export function formatPercent(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '0.0';
	return value.toFixed(1);
}

/** Context pressure: green until half, yellow until 80%, red beyond. */
export function contextTone(percent: number): Tone {
	if (percent >= 80) return 'danger';
	if (percent >= 50) return 'warn';
	return 'ok';
}

/** Cache hit rate: green when the prompt cache is doing real work. */
export function cacheTone(rate: number | null): Tone {
	if (rate == null) return 'muted';
	if (rate >= 50) return 'ok';
	if (rate >= 20) return 'warn';
	return 'muted';
}
