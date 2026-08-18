import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFilePaths,
  memoToMarkdown,
  samePaths,
  syncToVault,
} from '../main';

const taggedMemo = {
  slug: 'abc123',
  content: 'hello <strong>world</strong>',
  tags: [{ name: 'project/content' }, { name: 'story/diary' }],
  created_at: '2026-05-01 07:59:23',
  updated_at: '2026-05-01 08:00:00',
};

const untaggedMemo = {
  slug: 'untagged-1',
  content: 'plain memo',
  tags: [],
  created_at: '2026-05-02 10:20:03',
  updated_at: '2026-05-02 10:20:03',
};

test('tag mode uses tag folders', () => {
  assert.deepEqual(computeFilePaths('flomo', taggedMemo, 'tags'), [
    'flomo/project/content/2026-05-01_07-59-23.md',
    'flomo/story/diary/2026-05-01_07-59-23.md',
  ]);
  assert.deepEqual(computeFilePaths('flomo', untaggedMemo, 'tags'), [
    'flomo/_untagged/2026-05-02_10-20-03.md',
  ]);
});

test('date mode uses YYYY/MM/DD and ignores tags', () => {
  assert.deepEqual(computeFilePaths('flomo', taggedMemo, 'date'), [
    'flomo/2026/05/01/2026-05-01_07-59-23.md',
  ]);
  assert.deepEqual(computeFilePaths('flomo', untaggedMemo, 'date'), [
    'flomo/2026/05/02/2026-05-02_10-20-03.md',
  ]);
});

test('markdown keeps tags in frontmatter and content', () => {
  const md = memoToMarkdown(taggedMemo);
  assert.match(md, /- "project\/content"/);
  assert.match(md, /- "story\/diary"/);
  assert.match(md, /#project\/content #story\/diary/);
  assert.match(md, /hello \*\*world\*\*/);
});

test('samePaths compares path sets', () => {
  assert.equal(samePaths(['a/1.md', 'b/2.md'], ['b/2.md', 'a/1.md']), true);
  assert.equal(samePaths(['a/1.md'], ['a/2.md']), false);
});

function mockApp() {
  const files = new Map();
  const app = {
    vault: {
      adapter: {
        exists: async (p) => files.has(p),
        mkdir: async () => {},
        write: async (p, content) => { files.set(p, content); },
        remove: async (p) => { files.delete(p); },
      },
    },
  };
  return { app, files };
}

test('switching to date mode migrates existing tag-mode files', async () => {
  const { app, files } = mockApp();
  const settings = {
    bearerToken: '',
    flomoFolder: 'flomo',
    folderOrganization: 'date',
    autoSyncOnStartup: false,
    autoSyncIntervalMinutes: 0,
    lastSyncTime: 0,
    syncedMemos: {
      abc123: {
        updated_at: '2026-05-01 08:00:00',
        fileName: '2026-05-01_07-59-23',
        filePaths: ['flomo/project/content/2026-05-01_07-59-23.md'],
      },
    },
  };
  files.set('flomo/project/content/2026-05-01_07-59-23.md', 'old content');

  const result = await syncToVault(app, settings, [taggedMemo]);

  assert.equal(result.updatedCount, 1);
  assert.equal(files.has('flomo/project/content/2026-05-01_07-59-23.md'), false);
  assert.equal(files.has('flomo/2026/05/01/2026-05-01_07-59-23.md'), true);
  assert.deepEqual(settings.syncedMemos.abc123.filePaths, [
    'flomo/2026/05/01/2026-05-01_07-59-23.md',
  ]);
});

test('deleted memos remove their recorded files', async () => {
  const { app, files } = mockApp();
  const settings = {
    bearerToken: '',
    flomoFolder: 'flomo',
    folderOrganization: 'date',
    autoSyncOnStartup: false,
    autoSyncIntervalMinutes: 0,
    lastSyncTime: 0,
    syncedMemos: {
      abc123: {
        updated_at: '2026-05-01 08:00:00',
        fileName: '2026-05-01_07-59-23',
        filePaths: ['flomo/2026/05/01/2026-05-01_07-59-23.md'],
      },
    },
  };
  files.set('flomo/2026/05/01/2026-05-01_07-59-23.md', 'content');

  const result = await syncToVault(app, settings, []);

  assert.equal(result.deletedCount, 1);
  assert.equal(files.size, 0);
  assert.equal(settings.syncedMemos.abc123, undefined);
});
