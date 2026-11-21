/**
 * What a server's error answer means: the message to show, and which field each complaint is about.
 * Servers answer in a handful of shapes, and this reads the common ones:
 *
 * - Spring Boot: `{ status, error, message, errors: [{ field, defaultMessage }] }`
 * - Spring Data REST: `{ errors: [{ entity, property, invalidValue, message }] }`
 * - RFC 7807 problem details: `{ title, detail, status, errors: { name: ['…'] } }` or `invalid-params: [{ name, reason }]`
 * - Plain: `{ message, errors: { name: 'text' | ['text'] } }`, or just a string
 *
 * Kept free of the DOM and of the rest of the data layer, so a proxy, a model and a store can all use it.
 */

export interface ApiErrorInfo {
  status: number;
  /** One line a person can read */
  message: string;
  /** What is wrong with each field (a dotted path where the server gave one), in the order the server listed them */
  fields: Record<string, string[]>;
  /** Complaints about no field in particular */
  details: string[];
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function add(fields: Record<string, string[]>, details: string[], name: unknown, message: unknown): void {
  const m = text(message);
  if (!m) return;
  const n = text(name);
  if (n) (fields[n] ??= []).includes(m) || fields[n].push(m);
  else if (!details.includes(m)) details.push(m);
}

/** Read an error answer. `source` is an `AjaxError` (or anything with `status`, `message` and `response`), a body, or a string. */
export function parseApiError(source: unknown): ApiErrorInfo {
  const err = source as { status?: number; message?: string; response?: unknown } | null | undefined;
  const isError = !!err && typeof err === 'object' && ('response' in err || 'status' in err || source instanceof Error);
  const body: any = isError ? err!.response : source;
  const fields: Record<string, string[]> = {};
  const details: string[] = [];
  let message = '';

  if (typeof body === 'string') {
    message = text(body.length > 300 ? `${body.slice(0, 300)}…` : body) ?? '';
  } else if (body && typeof body === 'object') {
    message = text(body.detail) ?? text(body.message) ?? text(body.title) ?? text(body.error_description) ?? text(typeof body.error === 'string' ? body.error : undefined) ?? '';
    const list = body.errors ?? body.violations ?? body.fieldErrors;
    if (Array.isArray(list)) {
      for (const e of list) {
        if (typeof e === 'string') add(fields, details, undefined, e);
        else if (e && typeof e === 'object') add(fields, details, e.field ?? e.property ?? e.path ?? e.name ?? e.propertyPath, e.defaultMessage ?? e.message ?? e.reason ?? e.detail ?? e.msg);
      }
    } else if (list && typeof list === 'object') {
      for (const [name, value] of Object.entries(list)) {
        if (Array.isArray(value)) value.forEach(v => add(fields, details, name, typeof v === 'string' ? v : (v as any)?.message));
        else add(fields, details, name, typeof value === 'string' ? value : (value as any)?.message);
      }
    }
    if (Array.isArray(body['invalid-params'])) for (const p of body['invalid-params']) add(fields, details, p?.name, p?.reason);
    if (Array.isArray(body.invalidParams)) for (const p of body.invalidParams) add(fields, details, p?.name, p?.reason);
  }

  if (!message) message = text(isError ? err!.message : typeof source === 'string' ? source : undefined) ?? '';
  const first = Object.values(fields)[0]?.[0];
  // "Validation failed" tells a person little: say what is wrong when the server did
  if ((!message || /^(validation (failed|error)|bad request|unprocessable)/i.test(message)) && (first || details[0])) {
    const name = Object.keys(fields)[0];
    message = name ? `${name}: ${first}` : details[0];
  }
  return { status: isError ? Number(err!.status ?? 0) : 0, message: message || 'The request failed', fields, details };
}
