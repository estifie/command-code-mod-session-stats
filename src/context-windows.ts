/** Fallback when a model isn't in the table below (matches the CLI's own default). */
export const DEFAULT_CONTEXT_LIMIT = 200_000;

/**
 * Known model context windows, keyed by the model id reported on `model_request_end`.
 *
 * This is a snapshot of Command Code's catalog. An unknown or newer model falls back to
 * `DEFAULT_CONTEXT_LIMIT`, so the percentage is approximate but never crashes.
 */
export const CONTEXT_WINDOWS: Record<string, number> = {
	'claude-sonnet-5': 1_000_000,
	'claude-sonnet-4-6': 1_000_000,
	'claude-fable-5-1': 1_000_000,
	'claude-fable-5': 1_000_000,
	'claude-opus-5': 1_000_000,
	'claude-opus-4-8': 1_000_000,
	'claude-opus-4-7': 1_000_000,
	'claude-haiku-4-5-20251001': 200_000,
	'gpt-6-astra': 1_050_000,
	'gpt-5.6-sol': 1_050_000,
	'gpt-5.6-terra': 1_050_000,
	'gpt-5.6-luna': 1_050_000,
	'gpt-5.5': 400_000,
	'gpt-5.4': 400_000,
	'gpt-5.3-codex': 400_000,
	'gpt-5.4-mini': 400_000,
	'MiniMaxAI/MiniMax-M3-Free': 1_000_000,
	'MiniMaxAI/MiniMax-M3': 1_000_000,
	'MiniMaxAI/MiniMax-M2.5': 200_000,
	'minimax/minimax-m3-free': 1_000_000,
	'minimax/minimax-m2.7-free': 197_000,
	'deepseek/deepseek-v4-pro': 1_000_000,
	'deepseek/deepseek-v4-flash': 1_000_000,
	'deepseek/deepseek-v4-flash-vision-exp': 1_000_000,
	'deepseek/deepseek-v4-flash-fast': 1_000_000,
	'deepseek/deepseek-v4.1-flash': 1_000_000,
	'moonshotai/Kimi-K3': 1_000_000,
	'moonshotai/Kimi-K2.7-Code': 256_000,
	'moonshotai/Kimi-K2.7-Code-Highspeed': 262_000,
	'moonshotai/Kimi-K2.6': 256_000,
	'moonshotai/Kimi-K2.5': 256_000,
	'zai-org/GLM-5.3': 1_000_000,
	'zai-org/GLM-5.2': 1_000_000,
	'zai-org/GLM-5.2-Fast': 1_000_000,
	'zai-org/GLM-5': 200_000,
	'z-ai/glm-5.3-flash': 1_048_576,
	'xiaomi/mimo-v2.5-pro': 1_000_000,
	'xiaomi/mimo-v2.5': 1_000_000,
	'Qwen/Qwen3.7-Max': 1_000_000,
	'Qwen/Qwen3.7-Plus': 1_000_000,
	'Qwen/Qwen3.8-Max-0902': 1_000_000,
	'Qwen/Qwen3.8-Max': 1_000_000,
	'Qwen/Qwen3.8-27B': 262_144,
	'Qwen/Qwen3.8-Flash': 1_000_000,
	'Qwen/Qwen3.7-Flash': 1_000_000,
	'meituan/LongCat-2.0:free': 1_048_576,
	'stepfun/Step-3.7-Flash': 256_000,
	'stepfun/Step-3.5-Flash': 1_000_000,
	'tencent/hy4-preview': 1_048_576,
	'tencent/hy3-paid': 262_144,
	'tencent/Hy3': 262_144,
	'google/gemini-3.5-flash': 1_000_000,
	'google/gemini-3.8-flash': 1_000_000,
	'google/gemini-3.7-flash': 1_048_576,
	'google/gemini-3.6-flash': 1_000_000,
	'google/gemini-3.5-flash-lite': 1_000_000,
	'google/gemini-3.1-flash-lite': 1_000_000,
	'thinkingmachines/inkling': 256_000,
	'thinkingmachines/inkling-small': 1_000_000,
	'poolside/laguna-s-2.1-free': 256_000,
	'inclusionai/ling-3.0-flash-free': 256_000,
	'inclusionai/ling-3.0-flash-sante:free': 262_144,
	'sakana/fugu-ultra': 1_000_000,
	'xai/grok-4.5': 500_000,
	'xai/grok-4.6': 500_000,
	'meta/muse-spark-1.1': 1_048_576,
	'meta/muse-spark-1.2': 1_048_576,
	'meta/muse-spark-1.2-contributor': 1_048_576,
	'meta/muse-spark-1.3': 1_048_576,
	'meta/muse-spark-1.3-contributor': 1_048_576,
	'nvidia/nemotron-3-ultra-550b-a55b': 1_000_000,
};

/** Context window for a model id, or the default when unknown. */
export function contextLimitFor(model: string | null | undefined): number {
	if (!model) return DEFAULT_CONTEXT_LIMIT;
	return CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_LIMIT;
}
