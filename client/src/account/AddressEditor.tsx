import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiRequestError } from '../api/client';
import { api } from '../api/client';
import type { Country, SavedAddress } from '../api/types';
import { CheckboxField, FormField, SelectField } from '../components/FormField';
import { validateAddressField } from '../lib/address';
import type { AddressForm } from '../lib/address';
import { bookPayload, EMPTY_BOOK_FORM, formFromAddress, validateBookForm, validateCity, validateLabel } from '../lib/addressBook';
import type { BookErrors, BookForm } from '../lib/addressBook';
import styles from './Account.module.css';
import { ActionError } from '../components/ActionError';
import { failureOf } from '../lib/failure';
import type { Failure } from '../lib/failure';

interface AddressEditorProps {
  /** The address being edited, or null to add a new one. */
  address: SavedAddress | null;
  countries: Country[];
  /** True when the user has no addresses yet, so the new one becomes the default automatically. */
  isFirst: boolean;
  onSaved: (saved: SavedAddress) => void;
  onCancel: () => void;
}

/** Add or edit one address. Uses the same field rules as checkout and shows the server's per-field messages. */
export function AddressEditor({ address, countries, isFirst, onSaved, onCancel }: AddressEditorProps) {
  const [form, setForm] = useState<BookForm>(address ? formFromAddress(address) : EMPTY_BOOK_FORM);
  const [errors, setErrors] = useState<BookErrors>({});
  const [problem, setProblem] = useState<Failure | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const country = countries.find((c) => c.code === form.countryCode);
  const editing = address !== null;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function setField(field: keyof BookForm, value: string | boolean) {
    const next = { ...form, [field]: value } as BookForm;
    if (field === 'countryCode') next.regionCode = '';
    setForm(next);
    const cleared: BookErrors = { ...errors, [field]: undefined };
    if (field === 'countryCode') {
      cleared.regionCode = undefined;
      if (form.postalCode.trim() !== '') cleared.postalCode = validateAddressField('postalCode', next, countries) ?? undefined;
    }
    setErrors(cleared);
  }

  function blur(field: keyof AddressForm | 'label' | 'city') {
    let message: string | null;
    if (field === 'label') message = validateLabel(form.label);
    else if (field === 'city') message = validateCity(form.city);
    else message = validateAddressField(field, form, countries);
    setErrors((prev) => ({ ...prev, [field]: message ?? undefined }));
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    setProblem(null);
    const found = validateBookForm(form, countries);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstId = (['label', 'firstName', 'lastName', 'street', 'city', 'countryCode', 'regionCode', 'postalCode', 'phone'] as const).find((f) => found[f]);
      if (firstId) document.getElementById(`book-${firstId}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = bookPayload(form);
      const saved = editing
        ? await api<SavedAddress>(`/api/addresses/${address.id}`, { method: 'PATCH', body: payload })
        : await api<SavedAddress>('/api/addresses', { method: 'POST', body: { ...payload, isDefault: form.isDefault } });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors as BookErrors);
        setProblem({ message: err.message });
      } else {
        setProblem(failureOf(err, 'Could not save the address. Please try again.', () => void handleSubmit()));
      }
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className={styles.editor} aria-labelledby="address-editor-heading" data-testid="address-editor">
      <h3 id="address-editor-heading" ref={headingRef} tabIndex={-1} className={styles.editorHeading}>
        {editing ? 'Edit address' : 'Add an address'}
      </h3>
      <FormField
        id="book-label"
        label="Label (optional)"
        hint="For example Home or Work."
        value={form.label}
        error={errors.label}
        onChange={(e) => setField('label', e.target.value)}
        onBlur={() => blur('label')}
      />
      <div className={styles.twoCol}>
        <FormField
          id="book-firstName"
          label="First name"
          autoComplete="given-name"
          value={form.firstName}
          error={errors.firstName}
          onChange={(e) => setField('firstName', e.target.value)}
          onBlur={() => blur('firstName')}
        />
        <FormField
          id="book-lastName"
          label="Last name"
          autoComplete="family-name"
          value={form.lastName}
          error={errors.lastName}
          onChange={(e) => setField('lastName', e.target.value)}
          onBlur={() => blur('lastName')}
        />
      </div>
      <FormField
        id="book-street"
        label="Street address"
        autoComplete="address-line1"
        value={form.street}
        error={errors.street}
        onChange={(e) => setField('street', e.target.value)}
        onBlur={() => blur('street')}
      />
      <FormField
        id="book-city"
        label="City (optional)"
        autoComplete="address-level2"
        value={form.city}
        error={errors.city}
        onChange={(e) => setField('city', e.target.value)}
        onBlur={() => blur('city')}
      />
      <div className={styles.twoCol}>
        <SelectField
          id="book-countryCode"
          label="Country"
          placeholder="Select a country"
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
          value={form.countryCode}
          error={errors.countryCode}
          autoComplete="country"
          onChange={(e) => setField('countryCode', e.target.value)}
          onBlur={() => blur('countryCode')}
        />
        <SelectField
          id="book-regionCode"
          label="Region"
          placeholder={country ? 'Select a region' : 'Select a country first'}
          options={(country?.regions ?? []).map((r) => ({ value: r.code, label: r.name }))}
          value={form.regionCode}
          disabled={!country}
          error={errors.regionCode}
          onChange={(e) => setField('regionCode', e.target.value)}
          onBlur={() => blur('regionCode')}
        />
      </div>
      <div className={styles.twoCol}>
        <FormField
          id="book-postalCode"
          label="Postal code"
          autoComplete="postal-code"
          inputMode="numeric"
          hint={country ? `${country.name}: ${country.postalHint}` : 'Depends on the country'}
          value={form.postalCode}
          error={errors.postalCode}
          onChange={(e) => setField('postalCode', e.target.value)}
          onBlur={() => blur('postalCode')}
        />
        <FormField
          id="book-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          error={errors.phone}
          onChange={(e) => setField('phone', e.target.value)}
          onBlur={() => blur('phone')}
        />
      </div>
      {!editing && !isFirst && (
        <CheckboxField
          id="book-isDefault"
          label="Make this my default address"
          checked={form.isDefault}
          onChange={(e) => setField('isDefault', e.target.checked)}
        />
      )}
      {!editing && isFirst && <p className={styles.hintText}>This is your first address, so it will be your default.</p>}
      {problem && <ActionError failure={problem} className={styles.problem} />}
      <div className={styles.editorActions}>
        <button type="button" className="btn" onClick={onCancel} data-testid="address-cancel">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving} data-testid="address-save">
          {editing ? 'Save changes' : 'Add address'}
        </button>
      </div>
    </form>
  );
}
