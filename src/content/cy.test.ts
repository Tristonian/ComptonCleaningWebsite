import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { cy, SAME_IN_BOTH } from './cy';
import { isValidNodeKey } from '../lib/content/shared';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

// Every <Ed id="..."> in the source. Ids must be string literals so this scan (and the pencil)
// can see them; a computed id would be invisible here and is therefore not allowed.
const used = new Set<string>();
for (const file of walk(path.resolve(__dirname, '..'))) {
  // Comments are stripped first: doc examples such as `<Ed id="x">` are not real nodes.
  const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of code.matchAll(/<Ed\s+id="([^"]+)"/g)) used.add(m[1]);
}

describe('Welsh coverage (ADR 0004)', () => {
  it('finds the Ed nodes it is meant to check', () => {
    expect(used.size).toBeGreaterThan(0);
  });
  it('every <Ed id> has a Welsh default or is explicitly the same in both languages', () => {
    const missing = [...used].filter((id) => !(id in cy) && !SAME_IN_BOTH.has(id));
    expect(missing).toEqual([]);
  });
  it('has no stale Welsh entries for ids that no longer exist', () => {
    const stale = Object.keys(cy).filter((id) => !used.has(id) && id !== 'lang.switch');
    expect(stale).toEqual([]);
  });
  it('all ids are valid node keys and no Welsh string is empty', () => {
    for (const [id, text] of Object.entries(cy)) {
      expect(isValidNodeKey(id)).toBe(true);
      expect(text.trim()).not.toBe('');
    }
  });
});
