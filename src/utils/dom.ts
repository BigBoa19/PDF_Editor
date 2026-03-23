/**
 * Query a DOM element by selector, throwing if not found.
 */
export function qs<T extends HTMLElement>(selector: string, parent: ParentNode = document): T {
  const el = parent.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Element not found: ${selector}`);
  }
  return el;
}

/**
 * Create an HTML element with optional class names.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  ...classNames: string[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (classNames.length > 0) {
    el.classList.add(...classNames);
  }
  return el;
}
