import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiRequestError } from '../api/client';
import { CheckboxField, SelectField, TextAreaField } from '../components/FormField';
import { CONTACT_MESSAGE_MIN, CONTACT_TOPICS, validateContactField, validateContactValues } from '../lib/contact';
import type { ContactField, ContactValues } from '../lib/contact';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './ContactPage.module.css';

const EMPTY: ContactValues = { topic: '', message: '', consent: false };

/** /contact: topic, message and consent. The message is stored in the database (no email is sent). */
export function ContactPage() {
  useDocumentTitle('Contact us');
  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // Move focus to the success message so screen reader users hear it.
  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  function setValue<K extends ContactField>(field: K, value: ContactValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function blur(field: ContactField) {
    setErrors((prev) => ({ ...prev, [field]: validateContactField(field, values) ?? undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const found = validateContactValues(values);
    setErrors(found);
    const first = (['topic', 'message', 'consent'] as const).find((f) => found[f]);
    if (first) {
      document.getElementById(`contact-${first}`)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await api<{ id: number; message: string }>('/api/contact', {
        method: 'POST',
        body: { topic: values.topic, message: values.message.trim(), consent: values.consent },
      });
      setSent(res.message);
      setValues(EMPTY);
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors as typeof errors);
      setProblem(err instanceof ApiRequestError ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="contact-heading" className={styles.page}>
      <h1 id="contact-heading">Contact us</h1>
      <p className={styles.intro}>Questions about an order, a product or your account? Send us a message. This is a demo site, so nobody reads it and no email is sent.</p>

      {sent ? (
        <div ref={successRef} tabIndex={-1} role="status" className={styles.success} data-testid="contact-success">
          <h2>Message sent</h2>
          <p>{sent}</p>
          <button type="button" className="btn" onClick={() => setSent(null)}>
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate className={styles.form} aria-label="Contact form" data-testid="contact-form">
          <SelectField
            id="contact-topic"
            label="Topic"
            placeholder="Choose a topic"
            options={CONTACT_TOPICS.map((t) => ({ value: t.value, label: t.label }))}
            value={values.topic}
            error={errors.topic}
            onChange={(e) => setValue('topic', e.target.value)}
            onBlur={() => blur('topic')}
          />
          <TextAreaField
            id="contact-message"
            label="Message"
            hint={`At least ${CONTACT_MESSAGE_MIN} characters, at most 1000 (${values.message.trim().length} so far).`}
            value={values.message}
            error={errors.message}
            onChange={(e) => setValue('message', e.target.value)}
            onBlur={() => blur('message')}
          />
          <CheckboxField
            id="contact-consent"
            label="I agree that ShopLab may store my message so it can be answered."
            checked={values.consent}
            error={errors.consent}
            onChange={(e) => setValue('consent', e.target.checked)}
          />
          {problem && (
            <p role="alert" className={styles.problem}>
              {problem}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={sending} data-testid="contact-submit">
            Send message
          </button>
        </form>
      )}
    </section>
  );
}
