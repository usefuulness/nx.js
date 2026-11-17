import { describe, it, expect } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { columnName, crc32, createXlsx, zip } from '@/core/xlsx';

/** A small ZIP reader, to check the bytes against the format rather than against the writer. */
function unzip(bytes: Uint8Array): Map<string, { text: string; crcOk: boolean }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, { text: string; crcOk: boolean }>();
  // End of central directory is the last 22 bytes (no comment)
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  const count = view.getUint16(bytes.length - 12, true);
  let at = view.getUint32(bytes.length - 6, true);
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    out.set(name, { text: new TextDecoder().decode(data), crcOk: crc32(new Uint8Array(data)) === crc });
    at += 46 + nameLength;
  }
  return out;
}

const parse = (text: string) => new DOMParser().parseFromString(text, 'application/xml');

describe('xlsx', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('names columns like a spreadsheet', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702, 16383].map(columnName)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA', 'XFD']);
  });

  it('packs files into a valid zip with correct checksums, byte for byte reproducible', () => {
    const files = [{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'dir/b.txt', data: new Uint8Array(0) }];
    const read = unzip(zip(files));
    expect([...read.keys()]).toEqual(['a.txt', 'dir/b.txt']);
    expect(read.get('a.txt')).toEqual({ text: 'hello', crcOk: true });
    expect(read.get('dir/b.txt')!.crcOk).toBe(true);
    expect(zip(files)).toEqual(zip(files));
  });

  const sample = () => createXlsx({
    name: 'Sales: Q1/2026?',
    headers: ['Name', 'Amount', 'Joined', 'Active'],
    rows: [
      ['Ada <&> "L"', 1234.5, new Date(Date.UTC(2024, 2, 5)), true],
      ['=HYPERLINK("x")', -2, new Date(Date.UTC(2024, 11, 31, 13, 45, 30)), false],
      ['', Number.NaN, new Date(NaN), null]
    ]
  });

  it('writes the parts a workbook needs, all well-formed XML', () => {
    const parts = unzip(sample());
    expect([...parts.keys()]).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'
    ]);
    for (const [name, { text, crcOk }] of parts) {
      expect(crcOk, name).toBe(true);
      expect(parse(text).querySelector('parsererror'), name).toBeNull();
    }
  });

  it('types cells: text inline and escaped, numbers, booleans, dates as serials, formulas stay text', () => {
    const sheet = parse(unzip(sample()).get('xl/worksheets/sheet1.xml')!.text);
    const cell = (ref: string) => sheet.querySelector(`c[r="${ref}"]`)!;
    expect(cell('A1').getAttribute('s')).toBe('1'); // bold header
    expect(cell('A2').getAttribute('t')).toBe('inlineStr');
    expect(cell('A2').textContent).toBe('Ada <&> "L"');
    expect(cell('B2').querySelector('v')!.textContent).toBe('1234.5');
    expect(cell('C2').getAttribute('s')).toBe('2'); // date
    expect(cell('C2').querySelector('v')!.textContent).toBe('45356'); // 2024-03-05
    expect(cell('C3').getAttribute('s')).toBe('3'); // date and time
    expect(Number(cell('C3').querySelector('v')!.textContent)).toBeCloseTo(45657.5732639, 6);
    expect(cell('D2').getAttribute('t')).toBe('b');
    expect(cell('D3').querySelector('v')!.textContent).toBe('0');
    // Text beginning with "=" is data in a text cell, never a formula element
    expect(cell('A3').getAttribute('t')).toBe('inlineStr');
    expect(sheet.querySelector('f')).toBeNull();
    // Empty, NaN and invalid dates write nothing
    expect(sheet.querySelector('c[r="A4"]')).toBeNull();
    expect(sheet.querySelector('c[r="B4"]')).toBeNull();
    expect(sheet.querySelector('c[r="C4"]')).toBeNull();
  });

  it('freezes the header, adds a filter over the data, sizes columns and sanitizes the tab name', () => {
    const parts = unzip(sample());
    const sheet = parse(parts.get('xl/worksheets/sheet1.xml')!.text);
    expect(sheet.querySelector('pane')!.getAttribute('state')).toBe('frozen');
    expect(sheet.querySelector('autoFilter')!.getAttribute('ref')).toBe('A1:D4');
    expect(sheet.querySelectorAll('col')).toHaveLength(4);
    expect(parse(parts.get('xl/workbook.xml')!.text).querySelector('sheet')!.getAttribute('name')).toBe('Sales  Q1 2026');
  });

  it('strips characters XML cannot hold and caps text at the Excel limit', () => {
    const bytes = createXlsx({ headers: ['A'], rows: [['bad\u0001\u000B￾char'], ['x'.repeat(40_000)]] });
    const sheet = parse(unzip(bytes).get('xl/worksheets/sheet1.xml')!.text);
    expect(sheet.querySelector('parsererror')).toBeNull();
    expect(sheet.querySelector('c[r="A2"]')!.textContent).toBe('badchar');
    expect(sheet.querySelector('c[r="A3"]')!.textContent).toHaveLength(32_767);
  });

  it('refuses more rows or columns than Excel can open', () => {
    expect(() => createXlsx({ headers: ['A'], rows: new Array(1_048_576).fill(['x']) })).toThrow(RangeError);
    expect(() => createXlsx({ headers: new Array(16_385).fill('h'), rows: [] })).toThrow(RangeError);
  });

  it('falls back to Sheet1 for an empty or unusable name', () => {
    for (const name of [undefined, '', '   ', '///']) {
      expect(parse(unzip(createXlsx({ name, headers: ['A'], rows: [] })).get('xl/workbook.xml')!.text).querySelector('sheet')!.getAttribute('name')).toMatch(/^Sheet1$|^\s*$/);
    }
  });
});
