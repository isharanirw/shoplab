import styles from './Feedback.module.css';

/** A loading indicator that is announced to screen readers. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className={styles.spinnerWrap} role="status" data-testid="loading-spinner">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}...</span>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  title?: string;
}

/** The standard error state for a failed fetch: a message and a Retry button. */
export function ErrorState({ message, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  return (
    <div className={styles.error} role="alert" data-testid="error-state">
      <p className={styles.errorTitle}>{title}</p>
      <p>{message}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** A grey block that stands in for content while it loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`${styles.skeleton} ${className ?? ''}`} aria-hidden="true" />;
}
