import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CheckboxField, FormField } from '../components/FormField';
import { safeNext } from '../lib/navigation';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './AuthPages.module.css';

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.code === 'ACCOUNT_LOCKED') return 'This account has been locked. Please contact support.';
    if (err.code === 'RATE_LIMITED') return 'Too many failed login attempts. Please wait a minute and try again.';
    if (err.code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

export function LoginPage() {
  useDocumentTitle('Log in');
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={next} replace />;

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    setFormError(null);
    setRetryable(false);
    const errors: { email?: string; password?: string } = {};
    if (email.trim() === '') errors.email = 'Email is required.';
    if (password === '') errors.password = 'Password is required.';
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password, rememberMe);
    } catch (err) {
      setFormError(loginErrorMessage(err));
      setRetryable(err instanceof ApiRequestError && (err.status === 0 || err.status >= 500));
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="login-heading">
      <h1 id="login-heading">Log in</h1>
      {next !== '/account' && <p className={styles.note}>Please log in to continue.</p>}
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div role="alert" className={styles.formError} data-testid="login-error">
            {formError}
            {retryable && (
              <>
                {' '}
                <button type="button" className="btn btn-small" onClick={() => void handleSubmit()}>
                  Retry
                </button>
              </>
            )}
          </div>
        )}
        <FormField
          id="login-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <CheckboxField
          id="login-remember"
          label="Remember me"
          name="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <button type="submit" className={styles.submit} disabled={submitting}>
          Log in
        </button>
      </form>
      <p className={styles.alt}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </section>
  );
}
