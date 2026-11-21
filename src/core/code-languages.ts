/**
 * The languages `<nx-code-editor>` knows: how to find one (by id, alias, file extension or file name), how to colour
 * it, how to comment a line, when to indent after Enter, and how to check it. Free of the DOM, so it also runs on the
 * server (server HTML carries the colours) and in tests.
 *
 * The colouring is a small lexer, not a parser: it marks comments, strings, numbers, keywords, types, literals and the
 * parts of markup, data and configuration formats well enough to read code, and never fails or hangs on broken text.
 * A project that needs more registers a richer engine (see `code-engine.ts`) or its own language here.
 */

export type TokenType =
  | 'keyword' | 'type' | 'literal' | 'string' | 'comment' | 'number' | 'tag' | 'attr' | 'key' | 'heading'
  | 'emphasis' | 'meta' | 'variable' | 'added' | 'removed' | 'operator';

export interface Token {
  /** `null` is plain text */
  type: TokenType | null;
  text: string;
}

export interface CodeProblem {
  message: string;
  line: number;
  column: number;
}

/** A rule of the lexer: the first rule that matches at the cursor wins. */
interface Rule {
  re: RegExp;
  type: TokenType | null;
  /** Only at the start of a line */
  bol?: boolean;
  /** Words to classify (the match is looked up here; anything else is plain) */
  words?: Map<string, TokenType>;
  ci?: boolean;
  /** Only when the last non-space character before the cursor is one of these (or the text starts here): for regex literals */
  after?: string;
}

export interface CodeLanguage {
  id: string;
  label: string;
  /** Other names the `language` attribute accepts (`js`, `sh`, `yml`…), lower case */
  aliases: string[];
  /** File extensions without the dot, lower case */
  extensions: string[];
  /** Whole file names (`Dockerfile`, `.bashrc`) */
  filenames?: string[];
  /** How a line or a block is commented */
  comment?: { line?: string; block?: [string, string] };
  /** A line that makes Enter add an indent level (default: ends with `{`, `[` or `(`) */
  indentAfter?: RegExp;
  /** Colouring rules, in order */
  rules?: Rule[];
  /** Say what is wrong with the text, if anything */
  validate?: (text: string) => CodeProblem | null;
  /** A MIME type, for engines and downloads */
  mime?: string;
}

// ────────── Building rules ──────────

const sticky = (re: RegExp | string, flags = ''): RegExp => new RegExp(typeof re === 'string' ? re : re.source, `y${flags}${typeof re === 'string' ? '' : re.flags.replace(/[gy]/g, '')}`);
const rule = (type: TokenType | null, re: RegExp | string, extra: Partial<Rule> = {}): Rule => ({ re: sticky(re, extra.ci ? 'i' : ''), type, ...extra });
/** Classify identifiers: `words('keyword', 'if else while')` and the like, merged into one rule by `identifiers()` */
type WordSet = [TokenType, string];
const identifiers = (sets: WordSet[], ci = false, pattern = '[A-Za-z_$][\\w$]*'): Rule => {
  const words = new Map<string, TokenType>();
  for (const [type, list] of sets) for (const w of list.split(/\s+/).filter(Boolean)) words.set(ci ? w.toLowerCase() : w, type);
  return { re: sticky(pattern), type: null, words, ci };
};

const LINE_C = rule('comment', '//[^\\n]*');
const BLOCK_C = rule('comment', '/\\*[\\s\\S]*?(?:\\*/|$)');
const HASH = rule('comment', '#[^\\n]*');
const DQ = rule('string', '"(?:\\\\.|[^"\\\\\\n])*"?');
const SQ = rule('string', "'(?:\\\\.|[^'\\\\\\n])*'?");
const BQ = rule('string', '`(?:\\\\[\\s\\S]|[^`\\\\])*`?');
const NUM = rule('number', '\\b(?:0[xX][\\da-fA-F_]+|0[bB][01_]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)(?:[uUlLfFdDnN]{0,2})\\b');
const VAR_DOLLAR = rule('variable', '\\$(?:\\{[^}\\n]*\\}|[A-Za-z_]\\w*|[0-9@#?*!$-])');

const C_LIKE = { comment: { line: '//', block: ['/*', '*/'] as [string, string] } };

// ────────── Validators ──────────

const lineColumn = (text: string, at: number) => {
  const before = text.slice(0, Math.max(0, Math.min(at, text.length)));
  return { line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') };
};

/** Check JSON and say where it goes wrong: a small scanner of our own, so every browser gives the same answer. */
export function jsonProblem(text: string, options: { comments?: boolean; trailingCommas?: boolean } = {}): CodeProblem | null {
  if (!text.trim()) return null;
  let i = 0;
  const fail = (message: string, at = i): never => { throw { message, at }; };
  const ws = () => {
    for (;;) {
      while (i < text.length && /[ \t\r\n]/.test(text[i])) i++;
      if (options.comments && text.startsWith('//', i)) { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (options.comments && text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); if (end < 0) fail('a comment is not closed'); i = end + 2; continue; }
      return;
    }
  };
  const describe = () => (i >= text.length ? 'the text ends too soon' : `unexpected "${text[i]}"`);
  const string = (): void => {
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\n') fail('a string cannot continue onto a new line');
      if (text[i] === '\\') { i++; if (!/["\\/bfnrtu]/.test(text[i] ?? '')) fail('unknown escape'); }
      i++;
    }
    if (text[i] !== '"') fail('a string is not closed');
    i++;
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (options.trailingCommas && text[i] === '}') { i++; return; }
        if (text[i] !== '"') fail(`${describe()}, a name in quotes was expected`);
        string(); ws();
        if (text[i] !== ':') fail(`${describe()}, ":" was expected`);
        i++; value(); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        fail(`${describe()}, "," or "}" was expected`);
      }
    } else if (c === '[') {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        ws();
        if (options.trailingCommas && text[i] === ']') { i++; return; }
        value(); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        fail(`${describe()}, "," or "]" was expected`);
      }
    } else if (c === '"') string();
    else if (/-|\d/.test(c ?? '')) {
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
      if (!m) fail('not a valid number');
      i += m![0].length;
    } else {
      const word = /^(true|false|null)/.exec(text.slice(i));
      if (!word) fail(`${describe()}, a value was expected`);
      i += word![0].length;
    }
  };
  try {
    value(); ws();
    if (i < text.length) fail(`${describe()}, nothing should follow the value`);
    return null;
  } catch (e) {
    const err = e as { message: string; at: number };
    if (typeof err?.at !== 'number') throw e;
    return { message: err.message, ...lineColumn(text, err.at) };
  }
}

/** XML must be well formed. Uses the browser's parser, where there is one. */
function xmlProblem(text: string): CodeProblem | null {
  if (!text.trim() || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (!error) return null;
  const raw = (error.textContent ?? 'not well formed').trim();
  // Chrome: "error on line 3 at column 5: …"; Firefox: "Line Number 3, Column 5:"
  const at = /line (\d+) at column (\d+)/i.exec(raw) ?? /Line Number (\d+), Column (\d+)/i.exec(raw);
  const message = raw.split('\n').find(l => /error|expected|mismatch|unclosed|invalid/i.test(l) && !/^This page/i.test(l))?.replace(/^.*?(?:error on line \d+ at column \d+:|XML Parsing Error:)\s*/i, '').trim() || 'not well formed';
  return { message, line: at ? Number(at[1]) : 1, column: at ? Number(at[2]) : 1 };
}

/** Java properties: a `\u` escape needs four hex digits. */
function propertiesProblem(text: string): CodeProblem | null {
  const bad = /\\u(?![0-9a-fA-F]{4})/.exec(text);
  return bad ? { message: 'a \\u escape needs four hex digits', ...lineColumn(text, bad.index) } : null;
}

// ────────── The languages ──────────

const JS_KEYWORDS = 'as async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch throw try typeof var void while with yield';
const JS_LITERALS = 'true false null undefined NaN Infinity this';
const JS_TYPES = 'Array Boolean Date Error Map Number Object Promise RegExp Set String Symbol BigInt JSON Math console window document';
const TS_EXTRA = 'abstract any declare enum implements interface keyof namespace never override private protected public readonly type unknown unique infer is satisfies asserts module require';
const TS_TYPES = 'string number boolean object symbol bigint void Record Partial Required Readonly Pick Omit Promise Array';

const jsRules = (typescript: boolean): Rule[] => [
  LINE_C, BLOCK_C, BQ, DQ, SQ,
  rule('string', '/(?![*/])(?:\\\\.|\\[(?:\\\\.|[^\\]\\\\\\n])*\\]|[^/\\\\\\n[])+/[dgimsuyv]*', { after: '=(:,[!&|?{};>+-*%<' }),
  rule('meta', '@[A-Za-z_$][\\w$.]*'),
  NUM,
  identifiers([['keyword', typescript ? `${JS_KEYWORDS} ${TS_EXTRA}` : JS_KEYWORDS], ['literal', JS_LITERALS], ['type', typescript ? `${JS_TYPES} ${TS_TYPES}` : JS_TYPES]])
];

const JAVA_KEYWORDS = 'abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try var volatile while record sealed permits yield';
const JAVA_TYPES = 'boolean byte char double float int long short void String Object Integer Long Double Float Boolean Character List Map Set Optional Exception RuntimeException Class';

const GROOVY_KEYWORDS = 'abstract as assert break case catch class continue def default do else enum extends final finally for if implements import in instanceof interface new package private protected public return static super switch this throw throws trait try var while';
const GROOVY_TYPES = 'boolean byte char double float int long short void String Object Integer Long Double Float Boolean List Map Set Closure Date BigDecimal BigInteger Exception';

const SQL_KEYWORDS = 'select from where and or not in is like between exists distinct as join inner left right full outer cross on using group by having order asc desc limit offset union all intersect except insert into values update set delete create alter drop table view index database schema column constraint primary key foreign references unique default check add rename to truncate begin commit rollback transaction case when then else end with recursive returning if cascade grant revoke trigger procedure function returns declare exec execute explain analyze pragma vacuum';
const SQL_TYPES = 'int integer bigint smallint tinyint decimal numeric float real double precision char varchar text clob blob boolean bool date time timestamp datetime interval uuid json jsonb serial bytea';

const PY_KEYWORDS = 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case';
const SH_KEYWORDS = 'if then else elif fi for while until do done case esac in function select time return exit break continue local export readonly declare unset shift source alias eval exec set trap wait';

const C_KEYWORDS = 'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while _Bool _Complex';
const C_TYPES = 'void char short int long float double signed unsigned size_t ssize_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t bool FILE NULL';
const CPP_KEYWORDS = `${C_KEYWORDS} alignas alignof and bitand bitor catch class compl concept consteval constexpr constinit const_cast decltype delete dynamic_cast explicit export final friend mutable namespace new noexcept not operator or override private protected public reinterpret_cast requires static_assert static_cast template this throw try typeid typename using virtual xor co_await co_return co_yield`;

const CSHARP_KEYWORDS = 'abstract as base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using virtual volatile while async await var yield record init required with when where get set partial';
const CSHARP_TYPES = 'bool byte char decimal double float int long object sbyte short string uint ulong ushort void dynamic String Object List Dictionary Task IEnumerable Exception';

const GO_KEYWORDS = 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var';
const RUST_KEYWORDS = 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while';
const KOTLIN_KEYWORDS = 'as break by catch class companion constructor continue crossinline data do else enum expect actual external final finally for fun get if import in infix init inline inner interface internal is lateinit noinline object open operator out override package private protected public reified return sealed set super suspend this throw try typealias val var vararg when where while';
const SWIFT_KEYWORDS = 'actor any as associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough fileprivate final for func guard if import in indirect init inout internal is lazy let mutating nonmutating open operator override private protocol public repeat rethrows return self Self static struct subscript super switch throws try typealias var weak where while';
const PHP_KEYWORDS = 'abstract and as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield';
const RUBY_KEYWORDS = 'alias and begin break case class def defined? do else elsif end ensure for if in module next nil not or redo rescue retry return self super then undef unless until when while yield require require_relative include extend attr_accessor attr_reader attr_writer puts';
const GQL_KEYWORDS = 'query mutation subscription fragment on type interface union enum scalar input extend schema directive implements repeatable';

const CSS_AT = rule('meta', '@[\\w-]+');

const SCSS_LIKE_COMMENTS = [LINE_C, BLOCK_C];

const FLEX_MARKUP_STRINGS = [rule('string', '"[^"]*"?'), rule('string', "'[^']*'?")];

const languages: CodeLanguage[] = [
  { id: 'text', label: 'Plain text', aliases: ['plaintext', 'plain', 'txt', 'none', 'log'], extensions: ['txt', 'log', 'text'], mime: 'text/plain' },

  { id: 'javascript', label: 'JavaScript', aliases: ['js', 'jsx', 'node', 'nodejs', 'ecmascript', 'es6'], extensions: ['js', 'mjs', 'cjs', 'jsx'], ...C_LIKE, rules: jsRules(false), mime: 'text/javascript' },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts', 'tsx'], extensions: ['ts', 'tsx', 'mts', 'cts'], ...C_LIKE, rules: jsRules(true), mime: 'text/typescript' },
  { id: 'json', label: 'JSON', aliases: ['geojson', 'webmanifest'], extensions: ['json', 'map', 'geojson', 'webmanifest'], filenames: ['.babelrc', '.eslintrc'], mime: 'application/json', validate: t => jsonProblem(t),
    rules: [DQ, rule('literal', '\\b(?:true|false|null)\\b'), NUM] },
  { id: 'jsonc', label: 'JSON with comments', aliases: ['json5', 'jsonl-comments'], extensions: ['jsonc', 'json5'], filenames: ['tsconfig.json', 'jsconfig.json', '.eslintrc.json'], ...C_LIKE, mime: 'application/json', validate: t => jsonProblem(t, { comments: true, trailingCommas: true }),
    rules: [LINE_C, BLOCK_C, DQ, SQ, rule('literal', '\\b(?:true|false|null)\\b'), NUM] },

  { id: 'groovy', label: 'Groovy', aliases: ['gvy', 'gradle'], extensions: ['groovy', 'gvy', 'gy', 'gsh', 'gradle'], filenames: ['Jenkinsfile'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('string', '"""[\\s\\S]*?(?:"""|$)'), rule('string', "'''[\\s\\S]*?(?:'''|$)"), rule('string', '/(?![*/])(?:\\\\.|[^/\\\\\\n])+/', { after: '=(:,[!&|?{};~' }), DQ, SQ, rule('meta', '@[A-Za-z_$][\\w$.]*'), rule('variable', '\\$(?:\\{[^}\\n]*\\}|[A-Za-z_]\\w*)'), NUM,
      identifiers([['keyword', GROOVY_KEYWORDS], ['literal', 'true false null this it'], ['type', GROOVY_TYPES]])], mime: 'text/x-groovy' },
  { id: 'java', label: 'Java', aliases: ['jsp'], extensions: ['java'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('string', '"""[\\s\\S]*?(?:"""|$)'), DQ, SQ, rule('meta', '@[A-Za-z_$][\\w$.]*'), NUM,
      identifiers([['keyword', JAVA_KEYWORDS], ['literal', 'true false null'], ['type', JAVA_TYPES]])], mime: 'text/x-java' },
  { id: 'kotlin', label: 'Kotlin', aliases: ['kt', 'kts'], extensions: ['kt', 'kts'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('string', '"""[\\s\\S]*?(?:"""|$)'), DQ, SQ, rule('meta', '@[A-Za-z_$][\\w$.]*'), NUM,
      identifiers([['keyword', KOTLIN_KEYWORDS], ['literal', 'true false null'], ['type', 'Int Long Short Byte Float Double Boolean Char String Unit Any Nothing List Map Set Array']])] },
  { id: 'csharp', label: 'C#', aliases: ['cs', 'c#', 'dotnet'], extensions: ['cs', 'csx'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('string', '@"(?:""|[^"])*"?'), DQ, SQ, rule('meta', '^#[ \\t]*[a-z]+[^\\n]*', { bol: true }), NUM,
      identifiers([['keyword', CSHARP_KEYWORDS], ['literal', 'true false null'], ['type', CSHARP_TYPES]])] },
  { id: 'c', label: 'C', aliases: ['h'], extensions: ['c', 'h'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('meta', '#[ \\t]*[a-z]+(?:[ \\t]*<[^>\\n]*>)?', { bol: true }), DQ, SQ, NUM, identifiers([['keyword', C_KEYWORDS], ['type', C_TYPES], ['literal', 'true false NULL']])] },
  { id: 'cpp', label: 'C++', aliases: ['c++', 'cc', 'cxx', 'hpp'], extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'ino'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('meta', '#[ \\t]*[a-z]+(?:[ \\t]*<[^>\\n]*>)?', { bol: true }), rule('string', 'R"\\(([\\s\\S]*?)(?:\\)"|$)'), DQ, SQ, NUM,
      identifiers([['keyword', CPP_KEYWORDS], ['type', `${C_TYPES} string vector map set unique_ptr shared_ptr optional auto`], ['literal', 'true false nullptr NULL']])] },
  { id: 'go', label: 'Go', aliases: ['golang'], extensions: ['go'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, BQ, DQ, SQ, NUM, identifiers([['keyword', GO_KEYWORDS], ['literal', 'true false nil iota'], ['type', 'bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr any']])] },
  { id: 'rust', label: 'Rust', aliases: ['rs'], extensions: ['rs'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('string', 'r#*"[\\s\\S]*?(?:"#*|$)'), DQ, rule('string', "'(?:\\\\.|[^'\\\\\\n])'"), rule('meta', '#!?\\[[^\\]\\n]*\\]'), NUM,
      identifiers([['keyword', RUST_KEYWORDS], ['literal', 'true false None Some Ok Err'], ['type', 'bool char f32 f64 i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize str String Vec Option Result Box']])] },
  { id: 'swift', label: 'Swift', aliases: [], extensions: ['swift'], ...C_LIKE,
    rules: [LINE_C, BLOCK_C, rule('string', '"""[\\s\\S]*?(?:"""|$)'), DQ, rule('meta', '@[A-Za-z_]\\w*'), NUM, identifiers([['keyword', SWIFT_KEYWORDS], ['literal', 'true false nil'], ['type', 'Int Double Float Bool String Character Array Dictionary Set Optional Any AnyObject Void']])] },
  { id: 'php', label: 'PHP', aliases: [], extensions: ['php', 'phtml', 'php5', 'inc'], comment: { line: '//', block: ['/*', '*/'] },
    rules: [LINE_C, HASH, BLOCK_C, DQ, SQ, rule('meta', '<\\?(?:php|=)?|\\?>'), rule('variable', '\\$[A-Za-z_]\\w*'), NUM,
      identifiers([['keyword', PHP_KEYWORDS], ['literal', 'true false null TRUE FALSE NULL'], ['type', 'int float string bool array object mixed void iterable callable self parent']], false, '[A-Za-z_][\\w]*')], mime: 'application/x-httpd-php' },
  { id: 'ruby', label: 'Ruby', aliases: ['rb'], extensions: ['rb', 'rake', 'gemspec', 'ru'], filenames: ['Rakefile', 'Gemfile', 'Vagrantfile'], comment: { line: '#' },
    indentAfter: /(?:\b(?:def|class|module|if|unless|while|until|case|begin|do|else|elsif|when|rescue|ensure)\b[^\n]*|\|[^|\n]*\||[{[(])\s*$/,
    rules: [HASH, rule('string', '=begin[\\s\\S]*?(?:=end|$)', { bol: true }), DQ, SQ, rule('variable', '[@$]{1,2}[A-Za-z_]\\w*'), rule('literal', ':[A-Za-z_]\\w*[?!]?'), NUM, identifiers([['keyword', RUBY_KEYWORDS], ['literal', 'true false nil']], false, '[A-Za-z_]\\w*[?!]?')] },
  { id: 'python', label: 'Python', aliases: ['py', 'py3', 'python3'], extensions: ['py', 'pyw', 'pyi'], comment: { line: '#' }, indentAfter: /[:{[(]\s*(?:#[^\n]*)?$/,
    rules: [HASH, rule('string', '[rRbBfFuU]{0,2}"""[\\s\\S]*?(?:"""|$)'), rule('string', "[rRbBfFuU]{0,2}'''[\\s\\S]*?(?:'''|$)"), rule('string', '[rRbBfFuU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"?'), rule('string', "[rRbBfFuU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'?"), rule('meta', '@[A-Za-z_][\\w.]*'), NUM,
      identifiers([['keyword', PY_KEYWORDS], ['literal', 'True False None self cls'], ['type', 'int float str bool list dict set tuple bytes object type range Exception']], false, '[A-Za-z_]\\w*')], mime: 'text/x-python' },
  { id: 'lua', label: 'Lua', aliases: [], extensions: ['lua'], comment: { line: '--', block: ['--[[', ']]'] }, indentAfter: /(?:\b(?:then|do|else|function|repeat)\b[^\n]*|[{(])\s*$/,
    rules: [rule('comment', '--\\[(=*)\\[[\\s\\S]*?(?:\\]\\1\\]|$)'), rule('comment', '--[^\\n]*'), rule('string', '\\[(=*)\\[[\\s\\S]*?(?:\\]\\1\\]|$)'), DQ, SQ, NUM,
      identifiers([['keyword', 'and break do else elseif end for function goto if in local not or repeat return then until while'], ['literal', 'true false nil'], ['type', 'self string table math io os']], false, '[A-Za-z_]\\w*')] },

  { id: 'shell', label: 'Shell', aliases: ['sh', 'bash', 'zsh', 'ksh', 'console', 'terminal'], extensions: ['sh', 'bash', 'zsh', 'ksh', 'command'], filenames: ['.bashrc', '.bash_profile', '.zshrc', '.profile', '.envrc'], comment: { line: '#' }, indentAfter: /(?:\b(?:then|do|else)\b|\{|\()\s*$/,
    rules: [rule('meta', '#![^\\n]*', { bol: true }), HASH, DQ, SQ, rule('string', '\\$\\([^)\\n]*\\)?'), VAR_DOLLAR, NUM, identifiers([['keyword', SH_KEYWORDS], ['literal', 'true false']], false, '[A-Za-z_][\\w-]*')], mime: 'text/x-sh' },
  { id: 'powershell', label: 'PowerShell', aliases: ['ps1', 'pwsh', 'ps'], extensions: ['ps1', 'psm1', 'psd1'], comment: { line: '#', block: ['<#', '#>'] },
    rules: [rule('comment', '<#[\\s\\S]*?(?:#>|$)'), HASH, rule('string', '@"[\\s\\S]*?(?:"@|$)'), DQ, SQ, rule('variable', '\\$[A-Za-z_]\\w*|\\$\\{[^}\\n]*\\}'), NUM,
      identifiers([['keyword', 'begin break catch class continue data do dynamicparam else elseif end exit filter finally for foreach from function if in param process return switch throw trap try until using var while workflow'], ['literal', 'true false null']], true, '[A-Za-z_][\\w-]*')] },
  { id: 'batch', label: 'Batch file', aliases: ['bat', 'cmd', 'dos'], extensions: ['bat', 'cmd'], comment: { line: 'REM ' },
    rules: [rule('comment', '(?:rem\\b|::)[^\\n]*', { bol: true, ci: true }), DQ, rule('variable', '%[\\w~:*-]+%?|!\\w+!'), NUM, identifiers([['keyword', 'if else for in do goto call exit echo set setlocal endlocal not exist errorlevel defined equ neq lss leq gtr geq pause start copy move del dir cd md rd type'], ['literal', 'on off']], true, '[A-Za-z_]\\w*')] },
  { id: 'dockerfile', label: 'Dockerfile', aliases: ['docker', 'containerfile'], extensions: ['dockerfile'], filenames: ['Dockerfile', 'Containerfile'], comment: { line: '#' },
    rules: [HASH, rule('keyword', '(?:FROM|RUN|CMD|LABEL|MAINTAINER|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\\b', { bol: true, }), DQ, SQ, VAR_DOLLAR, NUM, rule('keyword', '\\b(?:AS)\\b')] },

  { id: 'sql', label: 'SQL', aliases: ['mysql', 'postgres', 'postgresql', 'pgsql', 'plsql', 'sqlite', 'mariadb', 'tsql'], extensions: ['sql', 'ddl', 'dml'], comment: { line: '--', block: ['/*', '*/'] },
    rules: [rule('comment', '--[^\\n]*'), BLOCK_C, SQ, rule('string', '"[^"\\n]*"?'), rule('string', '`[^`\\n]*`?'), NUM,
      identifiers([['keyword', SQL_KEYWORDS], ['type', SQL_TYPES], ['literal', 'true false null']], true, '[A-Za-z_][\\w$]*')], mime: 'text/x-sql' },
  { id: 'graphql', label: 'GraphQL', aliases: ['gql'], extensions: ['graphql', 'gql', 'graphqls'], comment: { line: '#' },
    rules: [HASH, rule('string', '"""[\\s\\S]*?(?:"""|$)'), DQ, rule('variable', '\\$[A-Za-z_]\\w*'), rule('meta', '@[A-Za-z_]\\w*'), NUM, identifiers([['keyword', GQL_KEYWORDS], ['literal', 'true false null'], ['type', 'Int Float String Boolean ID']], false, '[A-Za-z_]\\w*')] },

  { id: 'html', label: 'HTML', aliases: ['htm', 'xhtml', 'vue', 'svelte'], extensions: ['html', 'htm', 'xhtml', 'vue', 'svelte', 'jsp', 'ejs'], comment: { block: ['<!--', '-->'] }, mime: 'text/html',
    rules: [rule('comment', '<!--[\\s\\S]*?(?:-->|$)'), rule('meta', '<![A-Za-z][^>\\n]*>?'), rule('tag', '</?[A-Za-z][\\w:.-]*|/?>'), rule('attr', '[A-Za-z_:@#][\\w:.@#-]*(?==)'), ...FLEX_MARKUP_STRINGS, rule('variable', '&[#\\w]+;')] },
  { id: 'xml', label: 'XML', aliases: ['svg', 'xsd', 'xsl', 'xslt', 'rss', 'atom', 'plist', 'pom', 'wsdl'], extensions: ['xml', 'svg', 'xsd', 'xsl', 'xslt', 'rss', 'atom', 'plist', 'wsdl', 'xaml', 'csproj', 'config'], filenames: ['pom.xml'], comment: { block: ['<!--', '-->'] }, mime: 'application/xml', validate: xmlProblem,
    rules: [rule('comment', '<!--[\\s\\S]*?(?:-->|$)'), rule('string', '<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>|$)'), rule('meta', '<\\?[\\s\\S]*?(?:\\?>|$)|<![A-Za-z][^>\\n]*>?'), rule('tag', '</?[A-Za-z_][\\w:.-]*|\\??/?>'), rule('attr', '[A-Za-z_:][\\w:.-]*(?==)'), ...FLEX_MARKUP_STRINGS, rule('variable', '&[#\\w]+;')] },
  { id: 'twig', label: 'Twig / Jinja', aliases: ['jinja', 'jinja2', 'django', 'liquid', 'nunjucks', 'blade', 'handlebars', 'hbs', 'mustache', 'njk'], extensions: ['twig', 'jinja', 'jinja2', 'j2', 'njk', 'liquid', 'hbs', 'handlebars', 'mustache', 'blade.php'], comment: { block: ['{#', '#}'] },
    rules: [rule('comment', '\\{#[\\s\\S]*?(?:#\\}|$)'), rule('comment', '<!--[\\s\\S]*?(?:-->|$)'), rule('meta', '\\{%[-~]?|[-~]?%\\}|\\{\\{[-~]?|[-~]?\\}\\}'), rule('tag', '</?[A-Za-z][\\w:.-]*|/?>'), rule('attr', '[A-Za-z_:@#][\\w:.@#-]*(?==)'), ...FLEX_MARKUP_STRINGS,
      identifiers([['keyword', 'if elseif else endif for endfor in set endset block endblock extends include import from as macro endmacro call endcall with endwith autoescape endautoescape raw endraw filter endfilter embed endembed use verbatim endverbatim apply endapply not and or is'], ['literal', 'true false null none']], false, '[A-Za-z_]\\w*')] },
  { id: 'css', label: 'CSS', aliases: [], extensions: ['css'], comment: { block: ['/*', '*/'] }, mime: 'text/css',
    rules: [BLOCK_C, DQ, SQ, CSS_AT, rule('number', '#[\\da-fA-F]{3,8}\\b'), rule('number', '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:%|[a-z]{1,4})?'), rule('variable', '--[\\w-]+'), rule('key', '[A-Za-z-]+(?=\\s*:(?!:))'), rule('tag', '[.#][\\w-]+|::?[\\w-]+'), rule('literal', '!important')] },
  { id: 'scss', label: 'SCSS / Sass', aliases: ['sass'], extensions: ['scss', 'sass'], comment: { line: '//', block: ['/*', '*/'] },
    rules: [...SCSS_LIKE_COMMENTS, DQ, SQ, CSS_AT, rule('variable', '\\$[\\w-]+|--[\\w-]+'), rule('number', '#[\\da-fA-F]{3,8}\\b'), rule('number', '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:%|[a-z]{1,4})?'), rule('key', '[A-Za-z-]+(?=\\s*:(?!:))'), rule('tag', '&|[.#][\\w-]+|::?[\\w-]+')] },
  { id: 'less', label: 'Less', aliases: [], extensions: ['less'], comment: { line: '//', block: ['/*', '*/'] },
    rules: [...SCSS_LIKE_COMMENTS, DQ, SQ, rule('variable', '@[\\w-]+(?=\\s*:)|@\\{[\\w-]+\\}'), CSS_AT, rule('number', '#[\\da-fA-F]{3,8}\\b'), rule('number', '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:%|[a-z]{1,4})?'), rule('key', '[A-Za-z-]+(?=\\s*:(?!:))'), rule('tag', '&|[.#][\\w-]+|::?[\\w-]+')] },
  { id: 'markdown', label: 'Markdown', aliases: ['md', 'mdx', 'mkd', 'commonmark'], extensions: ['md', 'markdown', 'mdx', 'mkd'], comment: { block: ['<!--', '-->'] }, mime: 'text/markdown',
    rules: [rule('string', '```[\\s\\S]*?(?:```|$)|~~~[\\s\\S]*?(?:~~~|$)'), rule('comment', '<!--[\\s\\S]*?(?:-->|$)'), rule('heading', '#{1,6}[ \\t][^\\n]*', { bol: true }), rule('meta', '(?:[-*+]|\\d+[.)])[ \\t]', { bol: true }), rule('meta', '>[ \\t]?', { bol: true }), rule('string', '`[^`\\n]+`'), rule('emphasis', '\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__|\\*[^*\\n]+\\*|_[^_\\n]+_'), rule('attr', '!?\\[[^\\]\\n]*\\]'), rule('variable', '\\([^)\\s]+\\)|<https?://[^>\\s]+>')] },
  { id: 'plantuml', label: 'PlantUML', aliases: ['puml', 'uml'], extensions: ['puml', 'plantuml', 'pu', 'wsd', 'iuml'], comment: { line: "'", block: ["/'", "'/"] },
    rules: [rule('comment', "/'[\\s\\S]*?(?:'/|$)"), rule('comment', "'[^\\n]*"), rule('meta', '@(?:start|end)\\w+[^\\n]*'), DQ, rule('operator', '[-.=<>|*o#x+^]*(?:-|\\.)+[-.=<>|*o#x+^\\[\\]]*>|<[-.=|*o#x+^]*(?:-|\\.)+'), rule('variable', '\\$[A-Za-z_]\\w*'), rule('meta', '![a-z]+'), NUM,
      identifiers([['keyword', 'actor participant boundary control entity database collections queue class interface abstract enum annotation object package namespace node folder frame cloud component usecase rectangle state partition title legend header footer note end alt else opt loop par break critical group activate deactivate destroy return as of over left right top bottom skinparam hide show start stop if then elseif endif while endwhile repeat fork join'], ['literal', 'true false']], false, '[A-Za-z_]\\w*')] },

  { id: 'properties', label: 'Properties', aliases: ['props', 'java-properties', 'jproperties'], extensions: ['properties'], filenames: ['.env'], comment: { line: '#' }, mime: 'text/x-java-properties', validate: propertiesProblem,
    rules: [rule('comment', '[#!][^\\n]*', { bol: true }), rule('key', '[^\\s=:#!][^=:\\n]*?(?=\\s*[=:]|\\s+\\S|$)', { bol: true }), rule('operator', '[=:]'), rule('variable', '\\$\\{[^}\\n]*\\}'), rule('meta', '\\\\u[\\da-fA-F]{4}|\\\\[\\s\\S]')] },
  { id: 'ini', label: 'INI', aliases: ['cfg', 'conf', 'desktop', 'editorconfig'], extensions: ['ini', 'cfg', 'conf', 'desktop', 'editorconfig'], filenames: ['.gitconfig', '.editorconfig'], comment: { line: ';' },
    rules: [rule('comment', '[;#][^\\n]*', { bol: true }), rule('heading', '\\[[^\\]\\n]*\\]', { bol: true }), rule('key', '[^\\s=\\[;#][^=\\n]*?(?=\\s*=)', { bol: true }), rule('operator', '='), DQ, SQ, NUM, rule('literal', '\\b(?:true|false|yes|no|on|off)\\b', { ci: true })] },
  { id: 'toml', label: 'TOML', aliases: ['cargo'], extensions: ['toml'], filenames: ['Cargo.lock', 'pyproject.toml'], comment: { line: '#' },
    rules: [HASH, rule('string', '"""[\\s\\S]*?(?:"""|$)'), rule('string', "'''[\\s\\S]*?(?:'''|$)"), DQ, rule('string', "'[^'\\n]*'?"), rule('heading', '\\[\\[?[^\\]\\n]*\\]\\]?', { bol: true }), rule('key', '[\\w.-]+(?=\\s*=)', { bol: true }), rule('number', '\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})?)?'), NUM, rule('literal', '\\b(?:true|false)\\b')] },
  { id: 'yaml', label: 'YAML', aliases: ['yml'], extensions: ['yaml', 'yml'], filenames: ['.clang-format'], comment: { line: '#' }, indentAfter: /:\s*(?:#[^\n]*)?$|(?:^|\s)-\s*$/, mime: 'text/yaml',
    rules: [HASH, rule('meta', '---|\\.\\.\\.', { bol: true }), rule('key', '(?:-\\s+)?[^\\s#:"\'\\-][^:#\\n]*?(?=:(?:\\s|$))|"[^"\\n]*"(?=\\s*:)|\'[^\'\\n]*\'(?=\\s*:)', { bol: false }), DQ, rule('string', "'[^'\\n]*'?"), rule('variable', '[&*][\\w-]+'), rule('meta', '![\\w!<>:./-]*'), rule('literal', '\\b(?:true|false|null|yes|no|on|off|~)\\b', { ci: true }), NUM, rule('operator', '[|>][+-]?(?=\\s*$)')] },
  { id: 'diff', label: 'Diff', aliases: ['patch'], extensions: ['diff', 'patch'], comment: undefined,
    rules: [rule('meta', '(?:diff --git|index |--- |\\+\\+\\+ |@@)[^\\n]*', { bol: true }), rule('added', '\\+[^\\n]*', { bol: true }), rule('removed', '-[^\\n]*', { bol: true })] },
  { id: 'regex', label: 'Regular expression', aliases: ['regexp', 're'], extensions: [], rules: [rule('operator', '\\\\.|[()|?*+{}^$.]|\\[(?:\\\\.|[^\\]\\\\])*\\]')] }
];

// ────────── Looking one up ──────────

const byId = new Map<string, CodeLanguage>();
const byAlias = new Map<string, CodeLanguage>();
const byExtension = new Map<string, CodeLanguage>();
const byFilename = new Map<string, CodeLanguage>();

/** Add a language (or replace one with the same id). */
export function registerCodeLanguage(language: CodeLanguage): void {
  byId.set(language.id, language);
  byAlias.set(language.id, language);
  for (const a of language.aliases) byAlias.set(a.toLowerCase(), language);
  for (const e of language.extensions) byExtension.set(e.toLowerCase(), language);
  for (const f of language.filenames ?? []) byFilename.set(f.toLowerCase(), language);
}
languages.forEach(registerCodeLanguage);

/** Every language, in the order they were added. */
export function listCodeLanguages(): CodeLanguage[] {
  return [...byId.values()];
}

/** The language for an id or alias (`js`, `yml`, `C#`). `null` when there is none. */
export function findCodeLanguage(name: string | null | undefined): CodeLanguage | null {
  if (!name) return null;
  return byAlias.get(String(name).trim().toLowerCase()) ?? null;
}

/** The language for a file name or path: whole names first (`Dockerfile`), then the longest extension (`blade.php`, then `php`). */
export function codeLanguageForFile(file: string | null | undefined): CodeLanguage | null {
  if (!file) return null;
  const name = String(file).split(/[\\/]/).pop()!.toLowerCase();
  const whole = byFilename.get(name);
  if (whole) return whole;
  const parts = name.split('.');
  for (let i = 1; i < parts.length; i++) {
    const found = byExtension.get(parts.slice(i).join('.'));
    if (found) return found;
  }
  return byExtension.get(name) ?? null;
}

/** The canonical id for whatever the `language` attribute says, or `text`. */
export function resolveCodeLanguage(name: string | null | undefined): CodeLanguage {
  return findCodeLanguage(name) ?? byId.get('text')!;
}

// ────────── Colouring ──────────

const MAX_LEX = 200_000;

/** Split text into coloured and plain runs. Always covers every character, in order. Never throws. */
export function tokenizeCode(text: string, language: CodeLanguage | string | null | undefined): Token[] {
  const lang = typeof language === 'object' && language ? language : resolveCodeLanguage(language as string);
  const rules = lang.rules;
  if (!rules || !text || text.length > MAX_LEX) return text ? [{ type: null, text }] : [];
  const out: Token[] = [];
  let plain = 0;
  let i = 0;
  let prev = '';
  const flush = (to: number) => { if (to > plain) out.push({ type: null, text: text.slice(plain, to) }); };
  while (i < text.length) {
    const atLineStart = i === 0 || text[i - 1] === '\n';
    let matched = false;
    for (const r of rules) {
      if (r.bol && !atLineStart) continue;
      if (r.after !== undefined && prev !== '' && !r.after.includes(prev)) continue;
      r.re.lastIndex = i;
      const m = r.re.exec(text);
      if (!m || m.index !== i || !m[0]) continue;
      let type = r.type;
      if (r.words) type = r.words.get(r.ci ? m[0].toLowerCase() : m[0]) ?? null;
      if (type) { flush(i); out.push({ type, text: m[0] }); plain = i + m[0].length; }
      i += m[0].length;
      if (!/\s/.test(m[0][m[0].length - 1])) prev = m[0][m[0].length - 1];
      matched = true;
      break;
    }
    if (!matched) { if (!/\s/.test(text[i])) prev = text[i]; i++; }
  }
  flush(text.length);
  return out;
}

/** Whether a line of this language is already a comment (for toggling). */
export function lineCommentOf(language: CodeLanguage): string | null {
  return language.comment?.line ?? null;
}
