import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '@/core/events/event-emitter';

describe('EventEmitter', () => {
  it('on returns a function that stops listening', () => {
    const e = new EventEmitter();
    const fn = vi.fn();
    const off = e.on('x', fn);
    e.emit('x', 1);
    off();
    e.emit('x', 2);
    expect(fn.mock.calls).toEqual([[1]]);
  });

  it('once fires one time, and can be cancelled before it fires', () => {
    const e = new EventEmitter();
    const a = vi.fn(), b = vi.fn();
    e.once('x', a);
    e.emit('x', 1); e.emit('x', 2);
    expect(a).toHaveBeenCalledTimes(1);
    const cancel = e.once('x', b);
    cancel();
    e.emit('x', 3);
    expect(b).not.toHaveBeenCalled();
  });

  it('a handler that throws does not stop the others, and one that removes itself does not skip a neighbour', () => {
    const e = new EventEmitter();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const order: string[] = [];
    const first = () => { order.push('first'); e.off('x', first); };
    e.on('x', first);
    e.on('x', () => { throw new Error('boom'); });
    e.on('x', () => order.push('third'));
    e.emit('x');
    expect(order).toEqual(['first', 'third']);
    expect(error).toHaveBeenCalled();
    order.length = 0;
    e.emit('x');
    expect(order).toEqual(['third']);
    error.mockRestore();
  });

  it('a listener added while emitting waits for the next time', () => {
    const e = new EventEmitter();
    const late = vi.fn();
    e.on('x', () => e.on('x', late));
    e.emit('x');
    expect(late).not.toHaveBeenCalled();
    e.emit('x');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('removeAllListeners for one event or all', () => {
    const e = new EventEmitter();
    const a = vi.fn(), b = vi.fn();
    e.on('a', a); e.on('b', b);
    e.removeAllListeners('a');
    e.emit('a'); e.emit('b');
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([0, 1]);
    e.removeAllListeners();
    e.emit('b');
    expect(b).toHaveBeenCalledTimes(1);
  });
});
