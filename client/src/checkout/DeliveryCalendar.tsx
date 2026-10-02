import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ShippingMethod } from '../api/types';
import { disabledReason, disabledText, longDate, monthGrid, monthTitle, moveFocus, parseIsoDate, WEEKDAY_HEADERS } from '../lib/delivery';
import type { DeliveryWindow } from '../lib/delivery';
import styles from './DeliveryCalendar.module.css';

interface DeliveryCalendarProps {
  value: string | null;
  method: ShippingMethod;
  window: DeliveryWindow;
  onSelect: (isoDate: string) => void;
}

function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function lastOfMonth(iso: string): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * An accessible date grid for the preferred delivery date. The native date input cannot disable
 * weekends, so this is a table with role="grid": arrow keys move by day and week, Home and End jump
 * to the start and end of the week, PageUp and PageDown change month, Enter or Space selects. Days
 * that cannot be chosen stay focusable and are announced as unavailable (with the reason), they are
 * not removed from the grid.
 */
export function DeliveryCalendar({ value, method, window: range, onSelect }: DeliveryCalendarProps) {
  const titleId = useId();
  const gridRef = useRef<HTMLTableElement>(null);
  const moveFocusAfterRender = useRef(false);
  const min = firstOfMonth(range.earliest);
  const max = lastOfMonth(range.latest);
  const [focusDate, setFocusDate] = useState<string>(value && value >= range.earliest && value <= range.latest ? value : range.earliest);

  const year = Number(focusDate.slice(0, 4));
  const month = Number(focusDate.slice(5, 7)) - 1;
  const weeks = monthGrid(year, month, range, method);
  const canGoBack = firstOfMonth(focusDate) > min;
  const canGoForward = lastOfMonth(focusDate) < max;

  useEffect(() => {
    if (!moveFocusAfterRender.current) return;
    moveFocusAfterRender.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${focusDate}"]`)?.focus();
  }, [focusDate]);

  function goToMonth(delta: number) {
    const date = parseIsoDate(firstOfMonth(focusDate));
    if (!date) return;
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)).toISOString().slice(0, 10);
    const clamped = target < min ? min : target > max ? max : target;
    // Keep the focus on a day inside the window when the month contains one.
    const inWindow = clamped < range.earliest ? range.earliest : clamped > range.latest ? range.latest : clamped;
    setFocusDate(inWindow.slice(0, 7) === clamped.slice(0, 7) ? inWindow : clamped);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, iso: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(iso);
      return;
    }
    const next = moveFocus(iso, event.key, event.shiftKey, min, max);
    if (next === null) return;
    event.preventDefault();
    if (next === focusDate) {
      gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${next}"]`)?.focus();
      return;
    }
    moveFocusAfterRender.current = true;
    setFocusDate(next);
  }

  function select(iso: string) {
    if (disabledReason(iso, range, method)) return;
    setFocusDate(iso);
    onSelect(iso);
  }

  return (
    <div className={styles.calendar} data-testid="delivery-calendar">
      <div className={styles.header}>
        <button
          type="button"
          className="btn btn-small"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => goToMonth(-1)}
          data-testid="calendar-prev"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <h3 id={titleId} className={styles.title} aria-live="polite" data-testid="calendar-title">
          {monthTitle(year, month)}
        </h3>
        <button
          type="button"
          className="btn btn-small"
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => goToMonth(1)}
          data-testid="calendar-next"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <table ref={gridRef} className={styles.grid} role="grid" aria-labelledby={titleId}>
        <thead>
          <tr>
            {WEEKDAY_HEADERS.map((d) => (
              <th key={d.long} scope="col" abbr={d.long}>
                {d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.iso}>
              {week.map((day) => {
                if (!day.inMonth) return <td key={day.iso} className={styles.empty} />;
                const selected = day.iso === value;
                const label = [longDate(day.iso), day.disabled ? disabledText(day.disabled) : null, selected ? 'selected' : null]
                  .filter(Boolean)
                  .join(', ');
                const classes = [styles.day, day.disabled ? styles.disabled : '', selected ? styles.selected : ''].filter(Boolean).join(' ');
                return (
                  <td key={day.iso} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      className={classes}
                      tabIndex={day.iso === focusDate ? 0 : -1}
                      aria-disabled={day.disabled ? true : undefined}
                      aria-label={label}
                      data-date={day.iso}
                      data-testid={`calendar-day-${day.iso}`}
                      onClick={() => select(day.iso)}
                      onKeyDown={(e) => onKeyDown(e, day.iso)}
                      onFocus={() => {
                        if (day.iso !== focusDate) setFocusDate(day.iso);
                      }}
                    >
                      <span aria-hidden="true">{day.day}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.legend}>
        Available from {longDate(range.earliest)} to {longDate(range.latest)}.{method === 'standard' && ' Standard delivery is not available at weekends.'}
      </p>
    </div>
  );
}
