import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { f12 } from '../testability/variants';
import styles from './FormField.module.css';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
}

/** A label tied to its input, with an inline error message wired up for assistive tech. */
export function FormField({ id, label, error, hint, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={f12(id)} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={error ? `${styles.input} ${styles.inputInvalid}` : styles.input}
        aria-invalid={f12(error ? true : undefined)}
        aria-describedby={f12(describedBy)}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
}

/** A label tied to a textarea, with the same hint and error wiring as FormField. */
export function TextAreaField({ id, label, error, hint, ...areaProps }: TextAreaFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={f12(id)} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={error ? `${styles.input} ${styles.textarea} ${styles.inputInvalid}` : `${styles.input} ${styles.textarea}`}
        aria-invalid={f12(error ? true : undefined)}
        aria-describedby={f12(describedBy)}
        {...areaProps}
      />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  error?: string | null;
}

export function CheckboxField({ id, label, error, ...inputProps }: CheckboxFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <div className={styles.checkboxRow}>
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        <label htmlFor={id}>{label}</label>
      </div>
      {error && (
        <p id={errorId} className={styles.error} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}

/** A label tied to a select with a placeholder first option and the same error wiring as FormField. */
export function SelectField({ id, label, error, hint, placeholder, options, ...selectProps }: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={f12(id)} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={error ? `${styles.input} ${styles.inputInvalid}` : styles.input}
        aria-invalid={f12(error ? true : undefined)}
        aria-describedby={f12(describedBy)}
        {...selectProps}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
