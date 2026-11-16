/**
 * @file @/core/xlsx.ts
 *
 * A dependency-free `.xlsx` writer: one sheet, a bold frozen header row, an auto-filter, column
 * widths, and typed cells (text, numbers, booleans, dates). It writes the Office Open XML parts
 * and packs them in an uncompressed ZIP, so it is synchronous and runs anywhere (browser, Node).
 * DOM-free, like the other core helpers.
 */

export type XlsxCell = string | number | boolean | Date | null | undefined;

export interface XlsxSheet {
  /** Tab name (default "Sheet1"); invalid characters are replaced, 31 characters at most */
  name?: string;
  headers: string[];
  rows: XlsxCell[][];
  /** Column widths in characters (default: fitted to the content, 8–50) */
  widths?: number[];
}

const MAX_ROWS = 1_048_576;
const MAX_COLUMNS = 16_384;
const MAX_TEXT = 32_767;

/** Characters XML 1.0 cannot hold at all; Excel calls a file containing them corrupt. */
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const xml = (text: string): string =>
  text.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const sheetName = (name = 'Sheet1'): string => name.replace(/[\][:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet1';

/** Style indexes in styles.xml */
const STYLE = { header: 1, date: 2, dateTime: 3 } as const;

/** Excel stores a date as days since 1899-12-30; this reads the date as UTC, so no zone shift. */
const serial = (date: Date): number => date.getTime() / 86_400_000 + 25_569;

function cell(ref: string, value: XlsxCell, style?: number): string {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return style ? `<c r="${ref}"${s}/>` : '';
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : '';
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"${s}><v>${value ? 1 : 0}</v></c>`;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const timed = value.getTime() % 86_400_000 !== 0;
    return `<c r="${ref}" s="${timed ? STYLE.dateTime : STYLE.date}"><v>${serial(value)}</v></c>`;
  }
  // Text is stored inline (no shared-strings table); it is only ever text, never a formula
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(String(value).slice(0, MAX_TEXT))}</t></is></c>`;
}

const textLength = (value: XlsxCell): number =>
  value instanceof Date ? 19 : value === null || value === undefined ? 0 : String(value).length;

function sheetXml(sheet: XlsxSheet): string {
  const { headers, rows } = sheet;
  if (headers.length > MAX_COLUMNS) throw new RangeError(`Excel sheets hold at most ${MAX_COLUMNS} columns`);
  if (rows.length + 1 > MAX_ROWS) throw new RangeError(`Excel sheets hold at most ${MAX_ROWS.toLocaleString('en-US')} rows`);

  const widths = headers.map((header, c) => {
    if (sheet.widths?.[c]) return sheet.widths[c];
    const longest = rows.slice(0, 200).reduce((n, row) => Math.max(n, textLength(row[c])), header.length);
    return Math.min(50, Math.max(8, longest + 2));
  });

  const body = [
    `<row r="1">${headers.map((h, c) => cell(`${columnName(c)}1`, h, STYLE.header)).join('')}</row>`,
    ...rows.map((row, r) => {
      const n = r + 2;
      return `<row r="${n}">${headers.map((_, c) => cell(`${columnName(c)}${n}`, row[c])).join('')}</row>`;
    })
  ].join('');

  const last = `${columnName(Math.max(0, headers.length - 1))}${rows.length + 1}`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${body}</sheetData>` +
    (headers.length ? `<autoFilter ref="A1:${last}"/>` : '') +
    '</worksheet>'
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd\\ hh:mm:ss"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// ────────── ZIP (stored, no compression) ──────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 2020-01-01 00:00 in MS-DOS date/time, so the same data always gives the same bytes. */
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

export function zip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const header = (size: number, write: (view: DataView) => void): Uint8Array => {
    const bytes = new Uint8Array(size);
    write(new DataView(bytes.buffer));
    return bytes;
  };

  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = header(30, v => {
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true); // version needed
      v.setUint16(6, 0x0800, true); // UTF-8 names
      v.setUint16(8, 0, true); // stored
      v.setUint16(10, DOS_TIME, true);
      v.setUint16(12, DOS_DATE, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, nameBytes.length, true);
    });
    chunks.push(local, nameBytes, data);
    central.push(
      header(46, v => {
        v.setUint32(0, 0x02014b50, true);
        v.setUint16(4, 20, true); // made by
        v.setUint16(6, 20, true); // version needed
        v.setUint16(8, 0x0800, true);
        v.setUint16(10, 0, true);
        v.setUint16(12, DOS_TIME, true);
        v.setUint16(14, DOS_DATE, true);
        v.setUint32(16, crc, true);
        v.setUint32(20, data.length, true);
        v.setUint32(24, data.length, true);
        v.setUint16(28, nameBytes.length, true);
        v.setUint32(42, offset, true);
      }),
      nameBytes
    );
    offset += local.length + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, part) => n + part.length, 0);
  const end = header(22, v => {
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, files.length, true);
    v.setUint16(10, files.length, true);
    v.setUint32(12, centralSize, true);
    v.setUint32(16, offset, true);
  });

  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The bytes of a `.xlsx` file for one sheet. */
export function createXlsx(sheet: XlsxSheet): Uint8Array {
  const encoder = new TextEncoder();
  const name = sheetName(sheet.name);
  const part = (text: string) => encoder.encode(text);
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  return zip([
    {
      name: '[Content_Types].xml',
      data: part(
        `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>'
      )
    },
    {
      name: '_rels/.rels',
      data: part(
        `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>'
      )
    },
    {
      name: 'xl/workbook.xml',
      data: part(
        `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
      )
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: part(
        `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>'
      )
    },
    { name: 'xl/styles.xml', data: part(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: part(sheetXml(sheet)) }
  ]);
}
