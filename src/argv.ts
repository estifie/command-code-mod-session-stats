/**
 * Pull an explicit session id out of the process arguments.
 *
 * `cmd --resume <id>` / `-r <id>` name the session directly; `--session` may take either an
 * id or a transcript path. `--continue` carries no id (it means "the newest"), so it is
 * left to the on-disk probe in the mod.
 */
export function sessionIdFromArgv(argv: readonly string[]): string | null {
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--resume' || arg === '-r') {
			const value = argv[i + 1];
			if (value) return stripValue(value);
		}
		if (arg.startsWith('--resume=')) {
			const value = arg.slice('--resume='.length);
			if (value) return stripValue(value);
		}
		if (arg === '--session' || arg === '-s') {
			const value = argv[i + 1];
			if (value) return stripValue(value);
		}
		if (arg.startsWith('--session=')) {
			const value = arg.slice('--session='.length);
			if (value) return stripValue(value);
		}
	}
	return null;
}

function stripValue(value: string): string {
	const name = value.slice(value.lastIndexOf('/') + 1);
	return name.endsWith('.jsonl') ? name.slice(0, -'.jsonl'.length) : name;
}
