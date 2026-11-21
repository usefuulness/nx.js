import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { withLanguageTable } from '../../../scripts/code-languages-doc';
import {
  listCodeLanguages, findCodeLanguage, codeLanguageForFile, resolveCodeLanguage, tokenizeCode, registerCodeLanguage, jsonProblem, type TokenType
} from '@/core/code-languages';

/** What the editor must be able to open. Adding a language means adding it here, in the guide, and giving it a sample below. */
const REQUIRED = [
  'text', 'javascript', 'typescript', 'json', 'jsonc', 'groovy', 'java', 'kotlin', 'csharp', 'c', 'cpp', 'go', 'rust', 'swift', 'php', 'ruby', 'python', 'lua',
  'shell', 'powershell', 'batch', 'dockerfile', 'sql', 'graphql', 'html', 'xml', 'twig', 'css', 'scss', 'less', 'markdown', 'plantuml',
  'properties', 'ini', 'toml', 'yaml', 'diff', 'regex'
];

/** A snippet per language and the tokens it must contain: [type, text]. */
const SAMPLES: Record<string, { code: string; expect: Array<[TokenType, string]> }> = {
  text: { code: 'just words', expect: [] },
  javascript: { code: '// hi\nconst a = "x" + 1; /* c */ const r = /ab+c/g; if (a) return true;', expect: [['comment', '// hi'], ['keyword', 'const'], ['string', '"x"'], ['number', '1'], ['comment', '/* c */'], ['string', '/ab+c/g'], ['keyword', 'if'], ['literal', 'true']] },
  typescript: { code: 'interface A { x: string; }\n@Component() class B implements A {}', expect: [['keyword', 'interface'], ['type', 'string'], ['meta', '@Component'], ['keyword', 'implements']] },
  json: { code: '{"a": [1, 2.5e3, true, null]}', expect: [['string', '"a"'], ['number', '1'], ['number', '2.5e3'], ['literal', 'true'], ['literal', 'null']] },
  jsonc: { code: '{ // note\n "a": 1, /* x */ }', expect: [['comment', '// note'], ['string', '"a"'], ['comment', '/* x */']] },
  groovy: { code: "def run(ctx) {\n  println \"hi ${ctx.name}\"\n  return [ok: true] // done\n}\n@Field int x = 1", expect: [['keyword', 'def'], ['string', '"hi ${ctx.name}"'], ['keyword', 'return'], ['literal', 'true'], ['comment', '// done'], ['meta', '@Field'], ['type', 'int']] },
  java: { code: '@Override public static void main(String[] a) { /* x */ int n = 0x1F; }', expect: [['meta', '@Override'], ['keyword', 'public'], ['keyword', 'static'], ['type', 'void'], ['type', 'String'], ['comment', '/* x */'], ['number', '0x1F']] },
  kotlin: { code: 'fun main() { val x: Int = 1; when (x) { else -> null } }', expect: [['keyword', 'fun'], ['keyword', 'val'], ['type', 'Int'], ['keyword', 'when'], ['literal', 'null']] },
  csharp: { code: '#region A\nnamespace N { public class C { string s = @"a""b"; } }', expect: [['meta', '#region A'], ['keyword', 'namespace'], ['keyword', 'class'], ['type', 'string'], ['string', '@"a""b"']] },
  c: { code: '#include <stdio.h>\nint main(void) { return 0; } // end', expect: [['meta', '#include <stdio.h>'], ['type', 'int'], ['type', 'void'], ['keyword', 'return'], ['comment', '// end']] },
  cpp: { code: 'template <typename T> class A : public B { std::string s; auto p = nullptr; };', expect: [['keyword', 'template'], ['keyword', 'typename'], ['keyword', 'class'], ['keyword', 'public'], ['literal', 'nullptr'], ['type', 'auto']] },
  go: { code: 'package main\nfunc main() { var x int = 1; go f(); defer g() } // c', expect: [['keyword', 'package'], ['keyword', 'func'], ['keyword', 'var'], ['type', 'int'], ['keyword', 'go'], ['keyword', 'defer'], ['comment', '// c']] },
  rust: { code: '#[derive(Debug)] pub fn f(x: &str) -> Option<i32> { let mut y = 1u8; None } // c', expect: [['meta', '#[derive(Debug)]'], ['keyword', 'pub'], ['keyword', 'fn'], ['type', 'str'], ['type', 'Option'], ['keyword', 'let'], ['keyword', 'mut'], ['literal', 'None']] },
  swift: { code: 'import UIKit\n@objc class A { let x: Int = 1; var s: String? = nil }', expect: [['keyword', 'import'], ['meta', '@objc'], ['keyword', 'class'], ['keyword', 'let'], ['type', 'Int'], ['literal', 'nil']] },
  php: { code: '<?php\n$a = "x"; # c\nfunction f() { return null; } ?>', expect: [['meta', '<?php'], ['variable', '$a'], ['string', '"x"'], ['comment', '# c'], ['keyword', 'function'], ['keyword', 'return'], ['literal', 'null']] },
  ruby: { code: '# c\nclass A < B\n  def f(x) @y = :sym; puts "hi" end\nend', expect: [['comment', '# c'], ['keyword', 'class'], ['keyword', 'def'], ['variable', '@y'], ['literal', ':sym'], ['string', '"hi"'], ['keyword', 'end']] },
  python: { code: '# c\n@app.route("/")\ndef f(x: int = 1):\n    """doc"""\n    return None', expect: [['comment', '# c'], ['meta', '@app.route'], ['keyword', 'def'], ['type', 'int'], ['number', '1'], ['string', '"""doc"""'], ['keyword', 'return'], ['literal', 'None']] },
  lua: { code: '-- c\nlocal function f(x) return x or nil end\n--[[ block ]]', expect: [['comment', '-- c'], ['keyword', 'local'], ['keyword', 'function'], ['keyword', 'return'], ['literal', 'nil'], ['comment', '--[[ block ]]']] },
  shell: { code: '#!/bin/sh\n# c\nif [ -f "$HOME/x" ]; then echo ${A} $(date); fi', expect: [['meta', '#!/bin/sh'], ['comment', '# c'], ['keyword', 'if'], ['string', '"$HOME/x"'], ['keyword', 'then'], ['variable', '${A}'], ['string', '$(date)'], ['keyword', 'fi']] },
  powershell: { code: '# c\nfunction Get-X { param($a) if ($true) { return $a } }', expect: [['comment', '# c'], ['keyword', 'function'], ['keyword', 'param'], ['variable', '$a'], ['keyword', 'if'], ['keyword', 'return']] },
  batch: { code: 'REM c\n@echo off\nset X=%PATH%\nif exist a goto end', expect: [['comment', 'REM c'], ['keyword', 'echo'], ['literal', 'off'], ['keyword', 'set'], ['variable', '%PATH%'], ['keyword', 'if'], ['keyword', 'exist'], ['keyword', 'goto']] },
  dockerfile: { code: '# c\nFROM node:20 AS build\nENV A=1\nRUN echo "$A"', expect: [['comment', '# c'], ['keyword', 'FROM'], ['keyword', 'AS'], ['keyword', 'ENV'], ['keyword', 'RUN'], ['string', '"$A"']] },
  sql: { code: "-- c\nSELECT id, name FROM users WHERE age >= 18 AND name LIKE 'a%' ORDER BY id; /* x */", expect: [['comment', '-- c'], ['keyword', 'SELECT'], ['keyword', 'FROM'], ['keyword', 'WHERE'], ['number', '18'], ['keyword', 'AND'], ['string', "'a%'"], ['keyword', 'ORDER'], ['comment', '/* x */']] },
  graphql: { code: '# c\nquery Q($id: ID!) { user(id: $id) @include(if: true) { name } }', expect: [['comment', '# c'], ['keyword', 'query'], ['variable', '$id'], ['type', 'ID'], ['meta', '@include'], ['literal', 'true']] },
  html: { code: '<!-- c -->\n<a href="x" data-y=\'z\'>t&amp;</a>', expect: [['comment', '<!-- c -->'], ['tag', '<a'], ['attr', 'href'], ['string', '"x"'], ['attr', 'data-y'], ['variable', '&amp;'], ['tag', '</a']] },
  xml: { code: '<?xml version="1.0"?>\n<a b="c"><![CDATA[x]]><!-- n --></a>', expect: [['meta', '<?xml version="1.0"?>'], ['tag', '<a'], ['attr', 'b'], ['string', '"c"'], ['string', '<![CDATA[x]]>'], ['comment', '<!-- n -->']] },
  twig: { code: '{# c #}\n{% if user.ok %}<b class="x">{{ name }}</b>{% endif %}', expect: [['comment', '{# c #}'], ['meta', '{%'], ['keyword', 'if'], ['tag', '<b'], ['attr', 'class'], ['meta', '{{'], ['keyword', 'endif']] },
  css: { code: '/* c */\n.a:hover { color: #fff; margin: -2px 0; --x: 1; } @media (min-width: 1px) {}', expect: [['comment', '/* c */'], ['tag', '.a'], ['tag', ':hover'], ['key', 'color'], ['number', '#fff'], ['number', '-2px'], ['variable', '--x'], ['meta', '@media']] },
  scss: { code: '// c\n$c: red;\n.a { &:hover { color: $c; } }', expect: [['comment', '// c'], ['variable', '$c'], ['tag', '.a'], ['tag', '&'], ['key', 'color']] },
  less: { code: '// c\n@w: 10px;\n.a { width: @w; }', expect: [['comment', '// c'], ['variable', '@w'], ['tag', '.a'], ['key', 'width']] },
  markdown: { code: '# Title\n\n- item **bold** and `code` [link](http://x)\n> quote\n```js\nx\n```', expect: [['heading', '# Title'], ['meta', '- '], ['emphasis', '**bold**'], ['string', '`code`'], ['attr', '[link]'], ['variable', '(http://x)'], ['meta', '> '], ['string', '```js\nx\n```']] },
  plantuml: { code: "@startuml\n' c\nactor User\nUser -> Server : hello\n@enduml", expect: [['meta', '@startuml'], ['comment', "' c"], ['keyword', 'actor'], ['operator', '->'], ['meta', '@enduml']] },
  properties: { code: '# c\nname=Ada\\u00e9\ndb.url : jdbc:x ${home}', expect: [['comment', '# c'], ['key', 'name'], ['operator', '='], ['meta', '\\u00e9'], ['key', 'db.url'], ['operator', ':'], ['variable', '${home}']] },
  ini: { code: '; c\n[section]\nkey = "v"\nflag = true', expect: [['comment', '; c'], ['heading', '[section]'], ['key', 'key'], ['string', '"v"'], ['literal', 'true']] },
  toml: { code: '# c\n[server]\nport = 8080\nname = "x"\nok = true\nd = 2026-01-02', expect: [['comment', '# c'], ['heading', '[server]'], ['key', 'port'], ['number', '8080'], ['string', '"x"'], ['literal', 'true'], ['number', '2026-01-02']] },
  yaml: { code: '# c\n---\nname: Ada\nlist:\n  - a: 1\n  - &anc yes\nq: "x"', expect: [['comment', '# c'], ['meta', '---'], ['key', 'name'], ['key', 'list'], ['number', '1'], ['variable', '&anc'], ['literal', 'yes'], ['string', '"x"']] },
  diff: { code: 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n same', expect: [['meta', 'diff --git a/x b/x'], ['meta', '@@ -1 +1 @@'], ['removed', '-old'], ['added', '+new']] },
  regex: { code: '^(a|b)+\\d{2,3}[x-z]$', expect: [['operator', '^'], ['operator', '('], ['operator', '|'], ['operator', '+'], ['operator', '\\d'], ['operator', '[x-z]'], ['operator', '$']] }
};

const tokens = (id: string) => tokenizeCode(SAMPLES[id].code, id);

describe('code languages: the list', () => {
  it('has every language the editor is meant to open, and nothing unlisted', () => {
    const ids = listCodeLanguages().map(l => l.id);
    expect(ids).toEqual(expect.arrayContaining(REQUIRED));
    // A new language must be added to REQUIRED (and so to the guide and to SAMPLES): the list cannot grow unnoticed
    expect(ids.sort()).toEqual([...REQUIRED].sort());
  });

  it('every language has a label, a sample here, and is found by its id, aliases, extensions and file names', () => {
    for (const l of listCodeLanguages()) {
      expect(l.label, l.id).toBeTruthy();
      expect(SAMPLES[l.id], `a sample for ${l.id}`).toBeTruthy();
      expect(findCodeLanguage(l.id)?.id, l.id).toBe(l.id);
      expect(findCodeLanguage(l.id.toUpperCase())?.id).toBe(l.id);
      for (const a of l.aliases) expect(findCodeLanguage(a)?.id, `alias ${a}`).toBe(l.id);
      for (const e of l.extensions) expect(codeLanguageForFile(`file.${e}`)?.id, `.${e}`).toBe(l.id);
      for (const f of l.filenames ?? []) expect(codeLanguageForFile(f)?.id, f).toBe(l.id);
    }
  });

  it('aliases and extensions never point at two languages', () => {
    const seen = new Map<string, string>();
    for (const l of listCodeLanguages()) {
      for (const key of [...l.aliases.map(a => `alias:${a.toLowerCase()}`), ...l.extensions.map(e => `ext:${e.toLowerCase()}`), ...(l.filenames ?? []).map(f => `file:${f.toLowerCase()}`)]) {
        expect(seen.get(key), `${key} is claimed by ${seen.get(key)} and ${l.id}`).toBeUndefined();
        seen.set(key, l.id);
      }
    }
  });

  it('is mentioned in the guide, so the docs list what the editor knows', () => {
    const guide = readFileSync(path.resolve(__dirname, '../../../docs/editors.md'), 'utf8');
    for (const l of listCodeLanguages()) expect(guide, `docs/editors.md should list ${l.id}`).toContain(`\`${l.id}\``);
  });

  it('the guide\'s table is the registry\'s (run pnpm docs:languages when this fails)', () => {
    const file = path.resolve(__dirname, '../../../docs/editors.md');
    const guide = readFileSync(file, 'utf8');
    expect(withLanguageTable(guide)).toBe(guide);
  });

  it('finds a language from a file name or path, preferring whole names and the longest extension', () => {
    expect(codeLanguageForFile('/srv/app/Dockerfile')?.id).toBe('dockerfile');
    expect(codeLanguageForFile('scripts\\nightly.GROOVY')?.id).toBe('groovy');
    expect(codeLanguageForFile('tsconfig.json')?.id).toBe('jsonc');
    expect(codeLanguageForFile('data.json')?.id).toBe('json');
    expect(codeLanguageForFile('page.blade.php')?.id).toBe('twig');
    expect(codeLanguageForFile('index.php')?.id).toBe('php');
    expect(codeLanguageForFile('archive.tar.gz')).toBeNull();
    expect(codeLanguageForFile('')).toBeNull();
    expect(resolveCodeLanguage('nonsense').id).toBe('text');
    expect(resolveCodeLanguage('C#').id).toBe('csharp');
    expect(resolveCodeLanguage('yml').id).toBe('yaml');
  });

});

describe('code languages: colouring', () => {
  for (const id of REQUIRED.filter(i => i !== 'text')) {
    it(`${id}: marks what a reader needs to see`, () => {
      const toks = tokens(id);
      for (const [type, text] of SAMPLES[id].expect) {
        expect(toks.some(t => t.type === type && t.text === text), `${id}: expected ${type} ${JSON.stringify(text)} in ${JSON.stringify(toks.filter(t => t.type).map(t => [t.type, t.text]))}`).toBe(true);
      }
    });
  }

  it('covers every character, in order, for every language (so no text is ever lost or doubled)', () => {
    for (const l of listCodeLanguages()) {
      const code = SAMPLES[l.id].code;
      expect(tokenizeCode(code, l).map(t => t.text).join(''), l.id).toBe(code);
    }
  });

  it('plain text is one plain run, and empty text is nothing', () => {
    expect(tokenizeCode('just words', 'text')).toEqual([{ type: null, text: 'just words' }]);
    expect(tokenizeCode('', 'javascript')).toEqual([]);
    expect(tokenizeCode('x', 'unknown-language')).toEqual([{ type: null, text: 'x' }]);
  });

  it('does not stop on broken text: unclosed strings, comments and tags run to the end', () => {
    for (const id of ['javascript', 'html', 'python', 'sql', 'css', 'markdown']) {
      const code = '"never closed\n/* nor this\n<div attr="oops\n```\n\'\'\'';
      expect(tokenizeCode(code, id).map(t => t.text).join('')).toBe(code);
    }
  });

  it('keywords are not found inside longer words, and SQL ignores case', () => {
    expect(tokenizeCode('iffy format', 'javascript').some(t => t.type === 'keyword')).toBe(false);
    expect(tokenizeCode('select * From t', 'sql').filter(t => t.type === 'keyword').map(t => t.text)).toEqual(['select', 'From']);
  });

  it('a slash is a regular expression only where one can start, not a division', () => {
    const division = tokenizeCode('a = b / c / d', 'javascript');
    expect(division.some(t => t.type === 'string')).toBe(false);
    expect(tokenizeCode('x = /a/.test(s)', 'javascript').some(t => t.type === 'string' && t.text === '/a/')).toBe(true);
  });

  it('is fast enough to run on every keystroke, and gives up (plain) on huge text', () => {
    const big = 'const a = "x"; // c\n'.repeat(4000); // ~80 KB
    const t0 = performance.now();
    expect(tokenizeCode(big, 'javascript').length).toBeGreaterThan(1000);
    expect(performance.now() - t0).toBeLessThan(1500);
    const huge = 'a'.repeat(300_000);
    expect(tokenizeCode(huge, 'javascript')).toEqual([{ type: null, text: huge }]);
  });
});

describe('code languages: checking', () => {
  it('json: exact positions; jsonc allows comments and trailing commas', () => {
    expect(jsonProblem('{"a": }')).toMatchObject({ line: 1, column: 7 });
    expect(findCodeLanguage('json')!.validate!('{"a": 1,}')).not.toBeNull();
    expect(findCodeLanguage('jsonc')!.validate!('{ // c\n "a": 1, /* x */\n "b": [1, 2,], }')).toBeNull();
    expect(findCodeLanguage('jsonc')!.validate!('{ /* open')?.message).toMatch(/comment is not closed/);
    expect(findCodeLanguage('jsonc')!.validate!('{ "a": }')).not.toBeNull();
  });

  it('xml: well-formedness, with a position', () => {
    const xml = findCodeLanguage('xml')!;
    expect(xml.validate!('<a><b/></a>')).toBeNull();
    const bad = xml.validate!('<a>\n  <b></a>');
    expect(bad).not.toBeNull();
    expect(bad!.line).toBeGreaterThanOrEqual(1);
    expect(xml.validate!('')).toBeNull();
  });

  it('properties: a \\u escape needs four hex digits', () => {
    const props = findCodeLanguage('properties')!;
    expect(props.validate!('a=\\u00e9\nb=c')).toBeNull();
    expect(props.validate!('a=ok\nb=\\u12')).toMatchObject({ line: 2, column: 3 });
  });

  it('every language says how to comment (or that it cannot), consistently', () => {
    for (const l of listCodeLanguages()) {
      if (l.comment?.line) expect(l.comment.line.length, l.id).toBeGreaterThan(0);
      if (l.comment?.block) expect(l.comment.block, l.id).toHaveLength(2);
    }
    expect(findCodeLanguage('groovy')!.comment).toEqual({ line: '//', block: ['/*', '*/'] });
    expect(findCodeLanguage('python')!.comment).toEqual({ line: '#' });
    expect(findCodeLanguage('html')!.comment).toEqual({ block: ['<!--', '-->'] });
  });
});

// Last: it adds to the shared list, which the checks above read
describe('code languages: your own', () => {
  it('takes a language of your own, found like any other', () => {
    registerCodeLanguage({ id: 'custom-x', label: 'Custom X', aliases: ['cx'], extensions: ['cx'], rules: [] });
    expect(findCodeLanguage('cx')?.label).toBe('Custom X');
    expect(codeLanguageForFile('a.cx')?.id).toBe('custom-x');
    expect(tokenizeCode('anything', 'cx')).toEqual([{ type: null, text: 'anything' }]);
  });
});
