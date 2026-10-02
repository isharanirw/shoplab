import { numberAttribute, starModel } from '../lib/stars';

export const STAR_ELEMENT_TAG = 'shoplab-stars';

const TEMPLATE_STYLE = `
  :host { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; font-family: inherit; }
  .stars { color: #b45309; letter-spacing: 0.05em; }
  .empty { color: #9ca3af; }
  .value { color: var(--color-muted, #4b5563); }
`;

/** The rating widget. */
export class StarElement extends HTMLElement {
  static observedAttributes = ['value', 'count', 'show-count'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const model = starModel(numberAttribute(this.getAttribute('value'), 0), numberAttribute(this.getAttribute('count'), 0), this.getAttribute('show-count') !== 'false');
    root.innerHTML =
      `<style>${TEMPLATE_STYLE}</style>` +
      `<span class="stars" part="stars" aria-hidden="true">${'★'.repeat(model.filled)}<span class="empty">${'★'.repeat(model.empty)}</span></span>` +
      `<span class="value" part="value" aria-hidden="true">${model.valueText}${model.countText ? ` ${model.countText}` : ''}</span>`;
  }
}

/** Registers the element once (safe to call again, and a no-op outside a browser). */
export function defineStarElement(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(STAR_ELEMENT_TAG)) customElements.define(STAR_ELEMENT_TAG, StarElement);
}
