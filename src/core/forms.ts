/**
 * @file @/core/forms.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 */

const SUBMITTER_ATTRIBUTES = ['name', 'value', 'formaction', 'formmethod', 'formenctype', 'formtarget', 'formnovalidate'];

/**
 * Submit a native `<form>` like its submit button would: validation, the
 * `submit` event, and the button's name/value and form* overrides. Custom
 * elements can't be submitters, so a hidden native button stands in.
 */
export function submitForm(form: HTMLFormElement, submitter?: Element | null): void {
  const proxy = document.createElement('button');
  proxy.type = 'submit';
  proxy.hidden = true;
  SUBMITTER_ATTRIBUTES.forEach(attr => {
    const value = submitter?.getAttribute(attr);
    if (value !== null && value !== undefined) proxy.setAttribute(attr, value);
  });
  form.appendChild(proxy);
  try {
    form.requestSubmit(proxy);
  } finally {
    proxy.remove();
  }
}
