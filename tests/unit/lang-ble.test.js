import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Loads the real code from index.html: everything between "pure:start" and "pure:end" markers.
const html = readFileSync('index.html', 'utf8');
const src = [...html.matchAll(/\/\* pure:start \*\/([\s\S]*?)\/\* pure:end \*\//g)].map(m => m[1]).join('\n');
const { detectLang, createBleMidiParser } = new Function(`${src}; return { detectLang, createBleMidiParser };`)();

describe('detectLang', () => {
  it('picks the first supported language in preference order', () => {
    expect(detectLang(['en-GB', 'fr'])).toBe('en');
    expect(detectLang(['de-DE', 'fr-CA', 'en'])).toBe('fr');
    expect(detectLang(['EN_us'])).toBe('en');
  });
  it('falls back to French when nothing matches or input is empty', () => {
    expect(detectLang(['es-ES', 'de'])).toBe('fr');
    expect(detectLang([])).toBe('fr');
    expect(detectLang(undefined)).toBe('fr');
  });
});

describe('BLE-MIDI parser', () => {
  const H = 0x80 | 5, TS = 0x80 | 17;
  it('parses a single note-on', () => {
    expect(createBleMidiParser().parse([H, TS, 0x90, 60, 100])).toEqual([[0x90, 60, 100]]);
  });
  it('parses several messages, each with its own timestamp', () => {
    expect(createBleMidiParser().parse([H, TS, 0x90, 60, 100, TS + 1, 0x80, 60, 0]))
      .toEqual([[0x90, 60, 100], [0x80, 60, 0]]);
  });
  it('handles running status (timestamp then bare data bytes)', () => {
    expect(createBleMidiParser().parse([H, TS, 0x90, 60, 100, TS + 1, 62, 90]))
      .toEqual([[0x90, 60, 100], [0x90, 62, 90]]);
  });
  it('keeps running status across packets', () => {
    const p = createBleMidiParser();
    p.parse([H, TS, 0x90, 60, 100]);
    expect(p.parse([H, TS, 64, 80])).toEqual([[0x90, 64, 80]]);
  });
  it('parses one-data-byte messages (program change)', () => {
    expect(createBleMidiParser().parse([H, TS, 0xC0, 7])).toEqual([[0xC0, 7, 0]]);
  });
  it('skips SysEx, including one split over two packets, and real-time bytes', () => {
    const p = createBleMidiParser();
    expect(p.parse([H, TS, 0xF0, 0x00, 0x21, TS, 0xF8])).toEqual([]);
    expect(p.parse([H, 0x10, 0x20, TS, 0xF7, TS, 0x90, 61, 99])).toEqual([[0x90, 61, 99]]);
  });
  it('ignores stray data bytes with no status', () => {
    expect(createBleMidiParser().parse([H, 12, 13])).toEqual([]);
  });
});
