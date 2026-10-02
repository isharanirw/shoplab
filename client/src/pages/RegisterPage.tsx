import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CheckboxField, FormField } from '../components/FormField';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import {
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
  validateTerms,
} from '../lib/validation';
import styles from './AuthPages.module.css';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword' | 'acceptTerms', string>>;

export function RegisterPage() {
  useDocumentTitle('Register');
  const { user, register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  function setError(field: keyof Errors, message: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function validateAll(): Errors {
    const found: Errors = {};
    const checks: [keyof Errors, string | null][] = [
      ['name', validateName(name)],
      ['email', validateEmail(email)],
      ['password', validatePassword(password)],
      ['confirmPassword', validateConfirmPassword(password, confirmPassword)],
      ['acceptTerms', validateTerms(acceptTerms)],
    ];
    for (const [field, message] of checks) if (message) found[field] = message;
    return found;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateAll();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, confirmPassword, acceptTerms });
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors as Errors);
        if (err.code === 'CONFLICT') setFormError(err.message);
      } else {
        setFormError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="register-heading">
      <h1 id="register-heading">Create an account</h1>
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div role="alert" className={styles.formError} data-testid="register-error">
            {formError}
          </div>
        )}
        <FormField
          id="register-name"
          label="Full name"
          name="name"
          autoComplete="name"
          value={name}
          error={errors.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setError('name', validateName(name))}
        />
        <FormField
          id="register-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setError('email', validateEmail(email))}
        />
        <FormField
          id="register-password"
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="At least 8 characters with one uppercase letter, one digit and one symbol."
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setError('password', validatePassword(password))}
        />
        <FormField
          id="register-confirm"
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setError('confirmPassword', validateConfirmPassword(password, confirmPassword))}
        />
        <CheckboxField
          id="register-terms"
          label="I accept the terms and conditions"
          name="acceptTerms"
          checked={acceptTerms}
          error={errors.acceptTerms}
          onChange={(e) => {
            setAcceptTerms(e.target.checked);
            if (e.target.checked) setError('acceptTerms', null);
          }}
        />
        <button type="submit" className={styles.submit} disabled={submitting}>
          Create account
        </button>
      </form>
      <p className={styles.alt}>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
