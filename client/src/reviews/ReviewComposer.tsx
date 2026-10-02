import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { Review, ReviewEligibility } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { TextAreaField, FormField } from '../components/FormField';
import { ErrorState, Spinner } from '../components/Feedback';
import { loginPathFor } from '../lib/navigation';
import {
  formatFileSize,
  REVIEW_BODY_MIN,
  validateBody,
  validateImageFile,
  validateReviewValues,
  validateTitle,
} from '../lib/reviewForm';
import type { ReviewErrors, ReviewField } from '../lib/reviewForm';
import { useFetch } from '../hooks/useFetch';
import styles from './Reviews.module.css';

interface ReviewComposerProps {
  productId: number;
  onPosted: (review: Review) => void;
}

/**
 * The "write a review" area of the Reviews tab. Logged-out visitors and customers who have not bought
 * the product get an explanation instead of the form; buyers get the form (one review per product).
 */
export function ReviewComposer({ productId, onPosted }: ReviewComposerProps) {
  const { loading } = useAuth();
  const eligibility = useFetch<ReviewEligibility>(loading ? null : `/api/products/${productId}/review-eligibility`);
  const [posted, setPosted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  if (loading || eligibility.status === 'loading') return <Spinner label="Checking whether you can review this product" />;
  if (eligibility.status === 'error') return <ErrorState message={eligibility.error.message} onRetry={eligibility.retry} />;

  const result = eligibility.data;
  if (posted) {
    return (
      <div role="status" className={styles.notice} data-testid="review-posted">
        <p>Thank you, your review was posted. It is shown first in the list below.</p>
      </div>
    );
  }
  if (!result.eligible || alreadyReviewed) {
    const reason = alreadyReviewed ? 'already_reviewed' : result.reason;
    return (
      <div className={styles.notice} data-testid="review-ineligible" data-reason={reason ?? undefined}>
        {reason === 'login_required' && (
          <p>
            <Link to={loginPathFor(`/products/${productId}#reviews`)}>Log in</Link> to write a review. Only customers who have bought this product can
            review it.
          </p>
        )}
        {reason === 'not_purchased' && (
          <p>Only customers who have bought this product can review it. Once you have ordered it, the review form will appear here (cancelled orders do not count).</p>
        )}
        {reason === 'already_reviewed' && <p>You have already reviewed this product. Each customer can review a product once.</p>}
      </div>
    );
  }

  return (
    <ReviewForm
      productId={productId}
      onPosted={(review) => {
        setPosted(true);
        onPosted(review);
      }}
      onNotAllowed={() => setAlreadyReviewed(true)}
    />
  );
}

interface ReviewFormProps {
  productId: number;
  onPosted: (review: Review) => void;
  /** Called when the server says the user may no longer post (already reviewed). */
  onNotAllowed: () => void;
}

function ReviewForm({ productId, onPosted, onNotAllowed }: ReviewFormProps) {
  const [rating, setRating] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The preview is an object URL for the chosen file; release it when the file changes or the form goes away.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function setError(field: ReviewField, message: string | null) {
    setErrors((prev) => ({ ...prev, [field]: message ?? undefined }));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (!chosen) {
      setFile(null);
      setError('image', null);
      return;
    }
    const message = validateImageFile(chosen);
    if (message) {
      setFile(null);
      setError('image', message);
      event.target.value = '';
      return;
    }
    setError('image', null);
    setFile(chosen);
  }

  function removeFile() {
    setFile(null);
    setError('image', null);
    if (fileInput.current) fileInput.current.value = '';
    fileInput.current?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const found = validateReviewValues({ rating, title, body }, file);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (['rating', 'title', 'body', 'image'] as const).find((f) => found[f]);
      if (first === 'rating') document.getElementById('review-rating-1')?.focus();
      else if (first) document.getElementById(`review-${first}`)?.focus();
      return;
    }
    const form = new FormData();
    form.append('rating', rating);
    form.append('title', title.trim());
    form.append('body', body.trim());
    if (file) form.append('image', file, file.name);
    setSubmitting(true);
    try {
      const review = await api<Review>(`/api/products/${productId}/reviews`, { method: 'POST', formData: form });
      onPosted(review);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 403 || err.status === 409) {
          setProblem(err.message);
          onNotAllowed();
          return;
        }
        const fieldErrors = err.fieldErrors as ReviewErrors & { body?: string };
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        setProblem(err.message);
      } else {
        setProblem('Could not post your review. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className={styles.form} aria-labelledby="review-form-heading" data-testid="review-form">
      <h3 id="review-form-heading" className={styles.formHeading}>
        Write a review
      </h3>

      <fieldset className={styles.ratingSet} aria-describedby={errors.rating ? 'review-rating-error' : undefined}>
        <legend className={styles.legend}>Rating</legend>
        <div className={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={styles.ratingOption}>
              <input
                type="radio"
                id={`review-rating-${n}`}
                name="rating"
                value={String(n)}
                checked={rating === String(n)}
                aria-invalid={errors.rating ? true : undefined}
                onChange={() => {
                  setRating(String(n));
                  setError('rating', null);
                }}
              />
              <label htmlFor={`review-rating-${n}`}>
                {n}
                <span className="visually-hidden"> {n === 1 ? 'star' : 'stars'}</span>
              </label>
            </div>
          ))}
        </div>
        <p className={styles.hint}>1 is poor, 5 is excellent.</p>
        {errors.rating && (
          <p id="review-rating-error" className={styles.error} data-testid="review-rating-error">
            {errors.rating}
          </p>
        )}
      </fieldset>

      <FormField
        id="review-title"
        label="Title"
        value={title}
        maxLength={150}
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError('title', null);
        }}
        onBlur={() => setError('title', validateTitle(title))}
      />
      <TextAreaField
        id="review-body"
        label="Review"
        hint={`At least ${REVIEW_BODY_MIN} characters (${body.trim().length} so far).`}
        value={body}
        error={errors.body}
        onChange={(e) => {
          setBody(e.target.value);
          setError('body', null);
        }}
        onBlur={() => setError('body', validateBody(body))}
      />

      <div className={styles.fileField}>
        <label htmlFor="review-image" className={styles.fileLabel}>
          Photo (optional)
        </label>
        <input
          ref={fileInput}
          id="review-image"
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          aria-invalid={errors.image ? true : undefined}
          aria-describedby={['review-image-hint', errors.image ? 'review-image-error' : null].filter(Boolean).join(' ')}
          onChange={handleFile}
          data-testid="review-image-input"
        />
        <p id="review-image-hint" className={styles.hint}>
          PNG or JPG, up to 2 MB.
        </p>
        {errors.image && (
          <p id="review-image-error" className={styles.error} data-testid="review-image-error">
            {errors.image}
          </p>
        )}
        {file && previewUrl && (
          <div className={styles.preview} data-testid="review-image-preview">
            <img src={previewUrl} alt="Preview of the selected photo" className={styles.previewImage} />
            <div>
              <p className={styles.fileName} data-testid="review-image-name">
                {file.name} ({formatFileSize(file.size)})
              </p>
              <button type="button" className="btn btn-small" onClick={removeFile}>
                Remove photo
              </button>
            </div>
          </div>
        )}
      </div>

      {problem && (
        <p role="alert" className={styles.problem} data-testid="review-problem">
          {problem}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={submitting} data-testid="review-submit">
        Post review
      </button>
    </form>
  );
}

