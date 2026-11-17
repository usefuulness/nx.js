import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NX, type NXForm } from '@/index';
import { nextFrame } from '../utils';

const json = (body: unknown, status = 200, extra: { redirected?: boolean; url?: string } = {}) => {
  const response = new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (extra.redirected) Object.defineProperties(response, { redirected: { value: true }, url: { value: extra.url } });
  return response;
};
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

const mount = (attrs: Record<string, any> = {}) => {
  const form = NX.create<NXForm>({
    xtype: 'form',
    action: '/users',
    method: 'post',
    enhance: true,
    items: [
      { xtype: 'textfield', name: 'name', value: 'Ada', required: true },
      { xtype: 'email', name: 'email', value: 'ada@example.com' }
    ],
    buttons: [{ xtype: 'button', text: 'Save', type: 'submit' }],
    ...attrs
  });
  document.body.appendChild(form);
  return form;
};
const errorOf = (form: NXForm, name: string) =>
  form.getField(name)!.shadowRoot!.querySelector('.nx-field-helper')!.textContent;

describe('<nx-form enhance>', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    document.body.innerHTML = '';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the values with fetch, urlencoded, and announces success', async () => {
    fetchMock.mockResolvedValue(json({ id: 7 }, 201));
    const form = mount();
    const onSuccess = vi.fn();
    form.addEventListener('success', onSuccess);
    form.submit();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/users$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Accept).toBe('application/json');
    expect(String(init.body)).toBe('name=Ada&email=ada%40example.com');
    expect((onSuccess.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ status: 201, data: { id: 7 } });
  });

  it('does not post an invalid form', async () => {
    const form = mount();
    form.setValues({ name: '' });
    form.submit();
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is busy while waiting, and a double submit posts once', async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(resolve => (finish = resolve)));
    const form = mount();
    form.submit();
    form.submit();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(form.isSubmitting()).toBe(true);
    expect(form.getAttribute('aria-busy')).toBe('true');
    const button = form.querySelector('[slot="buttons"]')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    finish(json({}));
    await tick();
    expect(form.isSubmitting()).toBe(false);
    expect(form.hasAttribute('aria-busy')).toBe(false);
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('shows server errors on the named fields and clears one when the user edits it', async () => {
    fetchMock.mockResolvedValue(json({ errors: { email: ['Already taken', 'Use another'], name: 'Too short' } }, 422));
    const form = mount();
    const onError = vi.fn();
    form.addEventListener('error', onError);
    form.submit();
    await tick();
    await nextFrame();
    expect(errorOf(form, 'email')).toBe('Already taken Use another');
    expect(errorOf(form, 'name')).toBe('Too short');
    expect(form.getField('email')!.getAttribute('error-text')).toBe('Already taken Use another');
    expect((onError.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ status: 422, errors: { name: 'Too short' } });

    (form.getField('email') as any).value = 'new@example.com';
    form.getField('email')!.dispatchEvent(new CustomEvent('change', { bubbles: true }));
    expect(form.getField('email')!.hasAttribute('error-text')).toBe(false);
    await nextFrame();
    const input = (name: string) => form.getField(name)!.shadowRoot!.querySelector('input')!;
    expect(input('email').getAttribute('aria-invalid')).not.toBe('true');
    expect(input('name').getAttribute('aria-invalid')).toBe('true');
    expect(form.getField('name')!.hasAttribute('error-text')).toBe(true);
  });

  it('accepts a list of { field, message } and a general message', async () => {
    fetchMock.mockResolvedValue(json({ message: 'Rate limited', errors: [{ field: 'name', message: 'Taken' }, { field: '_form', message: 'Try later' }] }, 400));
    const form = mount();
    form.submit();
    await tick();
    await nextFrame();
    expect(errorOf(form, 'name')).toBe('Taken');
    const alert = form.shadowRoot!.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.hidden).toBe(false);
    expect(alert.textContent).toBe('Try later');
  });

  it('shows a form-level message when the server fails without field errors, and for network errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const form = mount();
    form.submit();
    await tick();
    await nextFrame();
    const alert = () => form.shadowRoot!.querySelector('[role="alert"]') as HTMLElement;
    expect(alert().textContent).toContain('500');

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const onError = vi.fn();
    form.addEventListener('error', onError);
    form.submit();
    await tick();
    expect(alert().textContent).toContain("Couldn't reach the server");
    expect((onError.mock.calls[0][0] as CustomEvent).detail.status).toBe(0);
    expect(form.isSubmitting()).toBe(false);
  });

  it('sends GET as a query string and honours the submit button formaction', async () => {
    fetchMock.mockResolvedValue(json({}));
    const form = mount({ method: 'get', action: '/search' });
    form.submit();
    await tick();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/search\?name=Ada&email=ada%40example\.com$/);
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();

    const button = form.querySelector('[slot="buttons"]') as HTMLElement;
    button.setAttribute('formaction', '/other');
    button.setAttribute('formmethod', 'post');
    form.submit(button);
    await tick();
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/other$/);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('a prevented submit event sends nothing, and a prevented success stops the redirect', async () => {
    const form = mount();
    form.addEventListener('submit', e => e.preventDefault(), { once: true });
    form.submit();
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();

    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, href: 'http://localhost/', assign });
    fetchMock.mockResolvedValue(json({}, 200, { redirected: true, url: 'http://localhost/done' }));
    form.addEventListener('success', e => e.preventDefault(), { once: true });
    form.submit();
    await tick();
    expect(assign).not.toHaveBeenCalled();
    form.submit();
    await tick();
    expect(assign).toHaveBeenCalledWith('http://localhost/done');
  });

  it('abort() cancels quietly', async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const form = mount();
    const onError = vi.fn();
    form.addEventListener('error', onError);
    form.submit();
    await tick();
    form.abort();
    await tick();
    expect(form.isSubmitting()).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it('without enhance it still navigates natively and never calls fetch', async () => {
    const form = mount({ enhance: false });
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    form.submit();
    await tick();
    expect(submit).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    submit.mockRestore();
  });
});
