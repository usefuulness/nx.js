/**
 * @file @/core/position.ts
 * @copyright Copyright (c) 2025 fool@nexaro.cloud
 *
 * Places floating UI (menus, popovers, tooltips, listboxes) next to an anchor:
 * flips to the other side when there is no room and stays inside the viewport.
 * The floating element is `position: fixed` (usually in the top layer).
 */

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Placement = Side | `${Side}-start` | `${Side}-end`;

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const MARGIN = 8;

/**
 * Position `floating` at `anchor` (an element, a rect, or a point). Returns the
 * side it ended up on, so callers can style an arrow or an origin.
 */
export function place(
  floating: HTMLElement,
  anchor: Element | DOMRect | { x: number; y: number },
  placement: Placement = 'bottom-start',
  offset = 4
): Side {
  const rect = anchor instanceof Element
    ? anchor.getBoundingClientRect()
    : 'width' in anchor ? anchor : new DOMRect(anchor.x, anchor.y, 0, 0);
  const [side, align = 'center'] = placement.split('-') as [Side, 'start' | 'end' | 'center'];
  const { innerWidth: vw, innerHeight: vh } = window;
  const width = floating.offsetWidth;
  const height = floating.offsetHeight;

  const coords = (s: Side) => {
    const vertical = s === 'top' || s === 'bottom';
    let x: number;
    let y: number;
    if (vertical) {
      y = s === 'bottom' ? rect.bottom + offset : rect.top - height - offset;
      x = align === 'start' ? rect.left : align === 'end' ? rect.right - width : rect.left + (rect.width - width) / 2;
    } else {
      x = s === 'right' ? rect.right + offset : rect.left - width - offset;
      y = align === 'start' ? rect.top : align === 'end' ? rect.bottom - height : rect.top + (rect.height - height) / 2;
    }
    const fits = vertical
      ? y >= MARGIN && y + height <= vh - MARGIN
      : x >= MARGIN && x + width <= vw - MARGIN;
    return { x, y, fits };
  };

  let final = side;
  let { x, y, fits } = coords(side);
  if (!fits) {
    const flipped = coords(OPPOSITE[side]);
    if (flipped.fits) {
      ({ x, y } = flipped);
      final = OPPOSITE[side];
    }
  }

  x = Math.max(MARGIN, Math.min(x, vw - width - MARGIN));
  y = Math.max(MARGIN, Math.min(y, vh - height - MARGIN));
  floating.style.left = `${Math.round(x)}px`;
  floating.style.top = `${Math.round(y)}px`;
  floating.dataset.side = final;
  return final;
}

/** Show an element with the Popover API when available (top layer, never clipped). */
export function showTopLayer(el: HTMLElement, mode: 'auto' | 'manual' = 'manual'): void {
  if (!el.hasAttribute('popover')) el.setAttribute('popover', mode);
  try {
    (el as any).showPopover?.();
  } catch {
    // already open, or unsupported: position: fixed + z-index still work
  }
}

export function hideTopLayer(el: HTMLElement): void {
  try {
    (el as any).hidePopover?.();
  } catch {
    // not open
  }
}
