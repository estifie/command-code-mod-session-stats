/**
 * Token usage as reported on the model-request boundary and persisted with a session.
 *
 * `inputTokens` INCLUDES the cached portions — the CLI bills the fresh input as
 * `inputTokens - cacheReadTokens - cacheWriteTokens`, so do the same. `costUsd` is only
 * present on entries the CLI was able to price.
 */
export interface Usage {
	inputTokens?: number;
	outputTokens?: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
	cacheWriteTokens1h?: number;
	costUsd?: number;
}

/** The subset of a session-log line this mod cares about. */
export interface SessionEntry {
	type?: string;
	id?: string;
	parentId?: string | null;
	usage?: Usage;
	model?: string;
}
