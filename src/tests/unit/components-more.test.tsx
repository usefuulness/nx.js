/**
 * Slider, date picker, avatar, alert, command and button tooltips.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Alert, Avatar, Button, Command, DatePicker, Slider, commandScore, initials, parseISODate,
  type NXCommand, type NXDatePicker, type NXSlider
} from '@/index';
import { nextFrame } from '../utils';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('slider', () => {
  it('clamps, defaults to the midpoint and resets', async () => {
    const slider = (<Slider name="v" min={0} max={10} step={2} />) as NXSlider;
    document.body.append(slider);
    await nextFrame();
    expect(slider.value).toBe(6); // midpoint, snapped to the step grid
    slider.value = 42;
    expect(slider.value).toBe(10);
    expect(slider.shadowRoot!.querySelector('input')!.value).toBe('10');
    slider.reset();
    expect(slider.value).toBe(6);
  });
});

describe('date picker', () => {
  it('parses only real calendar dates', () => {
    expect(parseISODate('2024-02-29')).toBeInstanceOf(Date);
    expect(parseISODate('2023-02-29')).toBeNull();
    expect(parseISODate('2024-1-5')).toBeNull();
  });

  it('formats the value, validates required/min and exposes valueAsDate', async () => {
    const picker = (<DatePicker name="d" label="Due" required min="2025-01-01" locale="en-US" />) as NXDatePicker;
    document.body.append(picker);
    await nextFrame();
    expect(picker.validationMessage()).toBe('Please select a date.');
    picker.value = '2024-12-31';
    expect(picker.validationMessage()).toBe('Choose Jan 1, 2025 or later.');
    picker.value = '2025-03-04';
    expect(picker.validationMessage()).toBe('');
    expect(picker.shadowRoot!.querySelector('.trigger')!.textContent).toContain('Mar 4, 2025');
    expect(picker.valueAsDate!.getDate()).toBe(4);
    picker.value = 'not a date';
    expect(picker.value).toBe('');
  });
});

describe('avatar and alert', () => {
  it('shows initials and names the image', async () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('prince')).toBe('PR');
    const avatar = (<Avatar alt="Grace Hopper" status="online" />) as HTMLElement;
    document.body.append(avatar);
    await nextFrame();
    const img = avatar.shadowRoot!.querySelector('[role=img]')!;
    expect(img.getAttribute('aria-label')).toBe('Grace Hopper, online');
    expect(img.textContent).toBe('GH');
  });

  it('uses role=alert only for urgent variants and can be dismissed', async () => {
    const info = (<Alert title="FYI">x</Alert>) as HTMLElement;
    const error = (<Alert variant="destructive" title="Failed" dismissible>x</Alert>) as HTMLElement;
    document.body.append(info, error);
    await nextFrame();
    expect(info.shadowRoot!.querySelector('.alert')!.getAttribute('role')).toBe('status');
    expect(error.shadowRoot!.querySelector('.alert')!.getAttribute('role')).toBe('alert');
    (error.shadowRoot!.querySelector('.close') as HTMLElement).click();
    expect(error.isConnected).toBe(false);
  });
});

describe('command', () => {
  it('ranks prefix > word > substring > keywords > letters in order', () => {
    const item = (text: string, keywords?: string[]) => ({ text, keywords });
    expect(commandScore(item('Settings'), 'set')).toBe(5);
    expect(commandScore(item('Open settings'), 'set')).toBe(4);
    expect(commandScore(item('Reset'), 'set')).toBe(3);
    expect(commandScore(item('Profile', ['settings']), 'set')).toBe(2);
    expect(commandScore(item('Sales report'), 'srt')).toBe(1);
    expect(commandScore(item('Users'), 'xyz')).toBe(0);
  });

  it('filters, moves with arrows and runs the highlighted item', async () => {
    const ran: string[] = [];
    const cmd = (
      <Command items={[
        { text: 'Dashboard', group: 'Go to' },
        { text: 'Settings', group: 'Go to', handler: item => ran.push(item.text) },
        { text: 'Sign out', group: 'Account', handler: item => ran.push(item.text) }
      ]} />
    ) as NXCommand;
    document.body.append(cmd);
    await nextFrame();
    const input = cmd.shadowRoot!.querySelector('input')!;
    const options = () => Array.from(cmd.shadowRoot!.querySelectorAll('[role=option]')).map(o => o.textContent);
    expect(options()).toEqual(['Dashboard', 'Settings', 'Sign out']);

    input.value = 'si';
    input.dispatchEvent(new Event('input'));
    // "Sign out" (prefix) beats "Settings" (letters in order); groups follow their best match
    expect(options()).toEqual(['Sign out', 'Settings']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(ran).toEqual(['Settings']);
    expect(input.getAttribute('aria-activedescendant')).toBe('cmd-1');
  });
});

describe('button tooltip', () => {
  it('names icon-only buttons and describes labelled ones', async () => {
    const icon = (<Button icon="settings" tooltip="Settings" />) as HTMLElement;
    const text = (<Button tooltip="Saves a draft">Save</Button>) as HTMLElement;
    document.body.append(icon, text);
    await nextFrame();
    const inner = (el: HTMLElement) => el.shadowRoot!.querySelector('button')!;
    expect(inner(icon).getAttribute('aria-label')).toBe('Settings');
    expect(inner(icon).hasAttribute('aria-describedby')).toBe(false);
    expect(inner(text).getAttribute('aria-label')).toBeNull();
    expect(inner(text).getAttribute('aria-describedby')).toBe('tip');
    expect(text.shadowRoot!.getElementById('tip')!.textContent).toBe('Saves a draft');
    expect(inner(text).hasAttribute('title')).toBe(false);
  });
});
