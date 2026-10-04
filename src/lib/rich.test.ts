import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { addTextBlock, listBlocks, updateBlockText } from './blocks';
import { getOverrides, saveNode } from './content/store';
import { plainToRichHtml, richToPlain, toDisplayHtml, toEditorHtml, toRichHtml } from './rich';
import { checkRichValue, cleanRichField, sanitizeRichHtml } from './rich-sanitize';

describe('plain text becomes paragraphs', () => {
  it('turns a blank line into a new paragraph and a single newline into a line break', () => {
    expect(plainToRichHtml('One\n\nTwo\nstill two')).toBe('<p>One</p><p>Two<br>still two</p>');
  });
  it('escapes markup typed as plain text', () => {
    expect(plainToRichHtml('<script>x</script> & more')).toBe('<p>&lt;script&gt;x&lt;/script&gt; &amp; more</p>');
  });
  it('leaves real rich text alone', () => {
    expect(toRichHtml('<p>Hi</p>')).toBe('<p>Hi</p>');
  });
});

describe('blank lines survive', () => {
  it('shows an empty paragraph as a visible blank line, and gives it back empty to the editor', () => {
    const stored = '<p>One</p><p></p><p>Two</p>';
    expect(toDisplayHtml(stored)).toBe('<p>One</p><p><br></p><p>Two</p>');
    expect(toEditorHtml('<p>One</p><p><br></p><p>Two</p>')).toBe(stored);
  });
  it('keeps blank paragraphs inside the text when saving but trims them at the ends', () => {
    expect(sanitizeRichHtml('<p></p><p>One</p><p></p><p></p><p>Two</p><p></p><p><br></p>')).toBe(
      '<p>One</p><p></p><p></p><p>Two</p>',
    );
  });
});

describe('sanitising', () => {
  it('drops scripts, handlers, styles and unknown tags but keeps the formatting Sam can make', () => {
    const out = sanitizeRichHtml(
      '<p onclick="x()" style="color:red">Hi <strong>there</strong><script>alert(1)</script><img src=x onerror=y></p><ul><li>a</li></ul>',
    );
    expect(out).toBe('<p>Hi <strong>there</strong></p><ul><li>a</li></ul>');
  });
  it('only allows safe link schemes and opens external links in a new tab', () => {
    expect(sanitizeRichHtml('<p><a href="javascript:alert(1)">x</a></p>')).not.toContain('javascript');
    expect(sanitizeRichHtml('<p><a href="https://example.com">x</a></p>')).toContain('target="_blank"');
    expect(sanitizeRichHtml('<p><a href="tel:07000000000">call</a></p>')).toContain('href="tel:07000000000"');
  });
  it('rejects text that is only blank paragraphs', () => {
    expect(checkRichValue('<p></p><p><br></p>').ok).toBe(false);
    expect(richToPlain('<p>a &amp; b</p><p>c</p>')).toBe('a & b\nc');
  });
  it('allows an empty field to be cleared', () => {
    expect(cleanRichField('<p></p>', 2000)).toEqual({ ok: true, value: '' });
    expect(cleanRichField('  plain  ', 2000)).toEqual({ ok: true, value: 'plain' });
    expect(cleanRichField('x'.repeat(2001), 2000).ok).toBe(false);
  });
});

describe('saving through the stores', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it('saves rich page text sanitised, blank paragraph kept', async () => {
    const r = await saveNode(
      { locale: 'en', key: 'about.body', value: '<p>One</p><p></p><p onclick="x">Two</p>', rich: true, by: 'sam@example.com' },
      db,
    );
    expect(r.ok).toBe(true);
    expect((await getOverrides('en', db))['about.body']).toBe('<p>One</p><p></p><p>Two</p>');
  });

  it('sanitises anything shaped like rich text even when the client says it is plain', async () => {
    await saveNode({ locale: 'en', key: 'about.body', value: '<p>Hi<script>x</script></p>', rich: false, by: 's' }, db);
    expect((await getOverrides('en', db))['about.body']).toBe('<p>Hi</p>');
  });

  it('still saves plain text as plain text', async () => {
    await saveNode({ locale: 'en', key: 'services.title', value: 'Our services', by: 's' }, db);
    expect((await getOverrides('en', db))['services.title']).toBe('Our services');
  });

  it('saves a text block as sanitised rich text', async () => {
    await addTextBlock({ zone: 'services', text: 'old', by: 's' }, db);
    const [b] = await listBlocks(db);
    expect((await updateBlockText({ id: b.id, locale: 'en', text: '<p>A</p><p></p><p>B</p><script>x</script>', by: 's' }, db)).ok).toBe(true);
    expect((await listBlocks(db))[0].textEn).toBe('<p>A</p><p></p><p>B</p>');
  });
});
