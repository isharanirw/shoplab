import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FormField } from '../components/FormField';
import { validateName } from '../lib/validation';
import styles from './Account.module.css';

/** Name editing (PATCH /api/auth/me). The email is shown but cannot be changed. */
export function ProfileSection() {
  const { user, updateName } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(null);
    setProblem(null);
    const message = validateName(name);
    setError(message);
    if (message) return;
    setSaving(true);
    try {
      const updated = await updateName(name.trim());
      setName(updated.name);
      setSaved('Your name was updated.');
    } catch (err) {
      if (err instanceof ApiRequestError && err.fieldErrors.name) setError(err.fieldErrors.name);
      else setProblem(err instanceof ApiRequestError ? err.message : 'Could not save your name. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="profile-heading">
      <h2 id="profile-heading">Profile</h2>
      <p>
        Signed in as <strong data-testid="account-name">{user.name}</strong>
      </p>
      <dl className={styles.details}>
        <dt>Email</dt>
        <dd data-testid="account-email">{user.email}</dd>
        <dt>Account type</dt>
        <dd>{user.role === 'admin' ? 'Administrator' : 'Customer'}</dd>
      </dl>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className={styles.nameForm} aria-label="Edit name">
        <FormField
          id="profile-name"
          label="Name"
          autoComplete="name"
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
            setSaved(null);
          }}
          onBlur={() => setError(validateName(name))}
        />
        <button type="submit" className="btn btn-primary" disabled={saving} data-testid="profile-save">
          Save name
        </button>
      </form>
      <div role="status" aria-live="polite">
        {saved && (
          <p className={styles.success} data-testid="profile-saved">
            {saved}
          </p>
        )}
      </div>
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem}
        </p>
      )}
    </section>
  );
}
