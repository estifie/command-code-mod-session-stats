import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, test} from 'node:test';
import {sessionIdFromArgv} from '../src/argv.ts';
import {
	findBySessionId,
	findFileContainingNonce,
	findNewestTranscript,
	isTranscriptFile,
	sessionIdFromPath,
} from '../src/session-finder.ts';

const root = mkdtempSync(join(tmpdir(), 'session-stats-finder-'));
after(() => rmSync(root, {recursive: true, force: true}));

function project(name: string, files: Record<string, string>): string {
	const dir = join(root, name);
	mkdirSync(dir, {recursive: true});
	for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content);
	return dir;
}

project('proj-a', {
	'aaaa-1111.jsonl': '{"type":"session"}\n',
	'aaaa-1111.checkpoints.jsonl': '{"type":"checkpoint"}\n',
	'bbbb-2222.jsonl': '{"type":"session","nonce":"NONCE-BBBB"}\n',
});
project('proj-b', {
	'cccc-3333.jsonl': '{"type":"session","nonce":"NONCE-CCCC"}\n',
});

test('isTranscriptFile skips checkpoint sidecars', () => {
	assert.equal(isTranscriptFile('x.jsonl'), true);
	assert.equal(isTranscriptFile('x.checkpoints.jsonl'), false);
	assert.equal(isTranscriptFile('x.meta.json'), false);
});

test('findBySessionId locates a transcript across project dirs', () => {
	const found = findBySessionId(root, 'aaaa-1111');
	assert.equal(found, join(root, 'proj-a', 'aaaa-1111.jsonl'));
	assert.equal(findBySessionId(root, 'missing'), null);
});

test('findFileContainingNonce identifies the transcript that received it', () => {
	assert.equal(findFileContainingNonce(root, 'NONCE-BBBB'), join(root, 'proj-a', 'bbbb-2222.jsonl'));
	assert.equal(findFileContainingNonce(root, 'NONCE-CCCC'), join(root, 'proj-b', 'cccc-3333.jsonl'));
	assert.equal(findFileContainingNonce(root, 'NONCE-ABSENT'), null);
});

test('findFileContainingNonce ignores files older than the freshness window', () => {
	assert.equal(findFileContainingNonce(root, 'NONCE-BBBB', {freshMs: -1}), null);
});

test('findNewestTranscript returns a recent transcript', () => {
	const newest = findNewestTranscript(root);
	assert.ok(newest?.endsWith('.jsonl'));
	assert.equal(findNewestTranscript(root, -1), null);
});

test('sessionIdFromPath strips the directory and extension', () => {
	assert.equal(sessionIdFromPath('/x/y/aaaa-1111.jsonl'), 'aaaa-1111');
	assert.equal(sessionIdFromPath('/x/y/aaaa.checkpoints.jsonl'), null);
});

test('sessionIdFromArgv reads the explicit resume flags', () => {
	assert.equal(sessionIdFromArgv(['node', 'cmd']), null);
	assert.equal(sessionIdFromArgv(['node', 'cmd', '--resume', 'abc']), 'abc');
	assert.equal(sessionIdFromArgv(['node', 'cmd', '-r', 'abc']), 'abc');
	assert.equal(sessionIdFromArgv(['node', 'cmd', '--resume=abc']), 'abc');
	assert.equal(sessionIdFromArgv(['node', 'cmd', '--session', '/tmp/x/y.jsonl']), 'y');
	assert.equal(sessionIdFromArgv(['node', 'cmd', '--session=abc']), 'abc');
	assert.equal(sessionIdFromArgv(['node', 'cmd', '--resume']), null);
});
