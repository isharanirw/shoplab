import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { ListResponse, Suggestion } from '../api/types';
import styles from './SearchBox.module.css';

export const SUGGEST_MIN_CHARS = 2;
export const SUGGEST_DEBOUNCE_MS = 300;

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: Suggestion[] };

/**
 * Header search with autocomplete. Suggestions are requested 300 ms after typing stops, once there
 * are at least 2 characters. Arrow keys move through up to 5 suggestions, Enter opens the highlighted
 * product (or runs a normal search when none is highlighted), and Escape closes the list.
 */
export function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const listId = useId();
  const inputId = `${listId}-input`;
  const containerRef = useRef<HTMLFormElement>(null);

  const [value, setValue] = useState('');
  /** The text that suggestions are fetched for. It changes only when the user types or retries. */
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggest, setSuggest] = useState<SuggestState>({ status: 'idle' });

  // On the listing page the box mirrors the q in the URL, so it survives reloads and back/forward.
  useEffect(() => {
    if (location.pathname === '/products') setValue(new URLSearchParams(location.search).get('q') ?? '');
  }, [location.pathname, location.search]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < SUGGEST_MIN_CHARS) {
      setSuggest({ status: 'idle' });
      setOpen(false);
      setActive(-1);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setOpen(true);
      setActive(-1);
      setSuggest({ status: 'loading' });
      api<ListResponse<Suggestion>>(`/api/products/suggest?q=${encodeURIComponent(text)}`, { signal: controller.signal })
        .then((res) => {
          if (!controller.signal.aborted) setSuggest({ status: 'success', items: res.data });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSuggest({ status: 'error', message: err instanceof ApiRequestError ? err.message : 'Could not load suggestions.' });
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  const items = suggest.status === 'success' ? suggest.items : [];

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function goToProduct(item: Suggestion) {
    setValue(item.name);
    setQuery('');
    close();
    navigate(`/products/${item.id}`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (open && active >= 0 && items[active]) {
      goToProduct(items[active]);
      return;
    }
    const text = value.trim();
    setQuery('');
    close();
    navigate(text ? `/products?q=${encodeURIComponent(text)}` : '/products');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (items.length === 0) return;
      event.preventDefault();
      if (!open) setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => {
        if (current === -1) return step === 1 ? 0 : items.length - 1;
        return (current + step + items.length) % items.length;
      });
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  const showPanel = open && suggest.status !== 'idle';
  const activeId = active >= 0 ? `${listId}-option-${active}` : undefined;
  const statusText =
    suggest.status === 'loading'
      ? 'Searching...'
      : suggest.status === 'success' && items.length === 0
        ? 'No suggestions'
        : '';

  return (
    <form
      ref={containerRef}
      role="search"
      className={styles.form}
      onSubmit={handleSubmit}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <label htmlFor={inputId} className="visually-hidden">
        Search products
      </label>
      <div className={styles.field}>
        <input
          id={inputId}
          type="search"
          name="q"
          className={`control ${styles.input}`}
          placeholder="Search products"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel && items.length > 0}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          data-testid="search-input"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </div>

      {showPanel && (
        <div className={styles.panel} data-testid="search-suggestions">
          {items.length > 0 && (
            <ul id={`${listId}-list`} role="listbox" aria-label="Search suggestions" className={styles.list}>
              {items.map((item, index) => (
                <li
                  key={item.id}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? `${styles.option} ${styles.optionActive}` : styles.option}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToProduct(item)}
                  onMouseEnter={() => setActive(index)}
                >
                  <span>{item.name}</span> <span className={styles.optionCategory}>in {item.category}</span>
                </li>
              ))}
            </ul>
          )}
          {items.length === 0 && <ul id={`${listId}-list`} role="listbox" aria-label="Search suggestions" className="visually-hidden" />}
          {statusText && (
            <p role="status" className={styles.status}>
              {statusText}
            </p>
          )}
          {suggest.status === 'error' && (
            <div role="alert" className={styles.status}>
              <span>Could not load suggestions. </span>
              <button type="button" className="btn btn-small" onMouseDown={(e) => e.preventDefault()} onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
      <div role="status" className="visually-hidden">
        {suggest.status === 'success' && items.length > 0 ? `${items.length} suggestions available. Use the up and down arrow keys.` : ''}
      </div>
    </form>
  );
}
