import type { Country, SavedAddress } from '../api/types';
import { FormField, SelectField } from '../components/FormField';
import { validateAddressField } from '../lib/address';
import type { AddressErrors, AddressForm } from '../lib/address';
import styles from './Checkout.module.css';

export type AddressChoice = number | 'new';

interface AddressStepProps {
  saved: SavedAddress[];
  countries: Country[];
  choice: AddressChoice;
  onChoice: (choice: AddressChoice) => void;
  form: AddressForm;
  onForm: (form: AddressForm) => void;
  errors: AddressErrors;
  onErrors: (errors: AddressErrors) => void;
}

function addressLines(a: SavedAddress): string {
  return [a.street, a.city, `${a.regionName}, ${a.postalCode}`, a.countryName].filter(Boolean).join(', ');
}

/** Step 1: pick a saved address or type a new one. Region options follow the chosen country. */
export function AddressStep({ saved, countries, choice, onChoice, form, onForm, errors, onErrors }: AddressStepProps) {
  const country = countries.find((c) => c.code === form.countryCode);

  function setField(field: keyof AddressForm, value: string) {
    const next = { ...form, [field]: value };
    if (field === 'countryCode') next.regionCode = '';
    onForm(next);
    // Editing a field clears its message; a country change also re-checks the postal code if it was filled in.
    const cleared: AddressErrors = { ...errors, [field]: undefined };
    if (field === 'countryCode') {
      cleared.regionCode = undefined;
      if (form.postalCode.trim() !== '') cleared.postalCode = validateAddressField('postalCode', next, countries) ?? undefined;
    }
    onErrors(cleared);
  }

  function blur(field: keyof AddressForm) {
    onErrors({ ...errors, [field]: validateAddressField(field, form, countries) ?? undefined });
  }

  return (
    <div>
      {saved.length > 0 && (
        <fieldset className={styles.choiceSet}>
          <legend className={styles.legend}>Choose an address</legend>
          {saved.map((a) => (
            <div key={a.id} className={styles.choice}>
              <input
                type="radio"
                id={`address-saved-${a.id}`}
                name="address-choice"
                checked={choice === a.id}
                onChange={() => onChoice(a.id)}
                data-testid={`address-saved-${a.id}`}
              />
              <label htmlFor={`address-saved-${a.id}`}>
                <strong>{a.label}</strong>
                {a.isDefault ? ' (default)' : ''}
                <span className={styles.choiceDetail}>
                  {a.firstName} {a.lastName}, {addressLines(a)}
                </span>
                <span className={styles.choiceDetail}>Phone {a.phone}</span>
              </label>
            </div>
          ))}
          <div className={styles.choice}>
            <input
              type="radio"
              id="address-new"
              name="address-choice"
              checked={choice === 'new'}
              onChange={() => onChoice('new')}
              data-testid="address-new"
            />
            <label htmlFor="address-new">
              <strong>Enter a new address</strong>
            </label>
          </div>
        </fieldset>
      )}

      {choice === 'new' && (
        <fieldset className={styles.formSet} data-testid="address-form">
          <legend className={saved.length > 0 ? styles.legend : 'visually-hidden'}>New address</legend>
          <div className={styles.twoCol}>
            <FormField
              id="addr-firstName"
              label="First name"
              autoComplete="given-name"
              value={form.firstName}
              error={errors.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              onBlur={() => blur('firstName')}
            />
            <FormField
              id="addr-lastName"
              label="Last name"
              autoComplete="family-name"
              value={form.lastName}
              error={errors.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              onBlur={() => blur('lastName')}
            />
          </div>
          <FormField
            id="addr-street"
            label="Street address"
            autoComplete="address-line1"
            value={form.street}
            error={errors.street}
            onChange={(e) => setField('street', e.target.value)}
            onBlur={() => blur('street')}
          />
          <div className={styles.twoCol}>
            <SelectField
              id="addr-countryCode"
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
              id="addr-regionCode"
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
              id="addr-postalCode"
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
              id="addr-phone"
              label="Phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              error={errors.phone}
              onChange={(e) => setField('phone', e.target.value)}
              onBlur={() => blur('phone')}
            />
          </div>
        </fieldset>
      )}
    </div>
  );
}
