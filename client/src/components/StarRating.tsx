import type { RatingSummary } from '../api/types';
import { pluralise } from '../lib/format';
import styles from './ProductParts.module.css';

interface StarRatingProps {
  rating: RatingSummary;
  /** Shows "(28)" after the number. */
  showCount?: boolean;
  /** Replaces the default accessible name, for example "4 out of 5 stars" on a single review. */
  ariaLabel?: string;
}

/**
 * Plain markup for now: five star characters plus the average and review count. The accessible
 * name carries the same information in words.
 */
export function StarRating({ rating, showCount = true, ariaLabel }: StarRatingProps) {
  if (rating.average === null) {
    return <span className={styles.noRating}>No reviews yet</span>;
  }
  const filled = Math.round(rating.average);
  const label = `Rated ${rating.average.toFixed(1)} out of 5 from ${pluralise(rating.count, 'review')}`;
  return (
    <span className={styles.rating} role="img" aria-label={ariaLabel ?? label}>
      <span aria-hidden="true" className={styles.stars}>
        {'★'.repeat(filled)}
        <span className={styles.starsEmpty}>{'★'.repeat(5 - filled)}</span>
      </span>
      <span aria-hidden="true" className={styles.ratingText}>
        {rating.average.toFixed(1)}
        {showCount && ` (${rating.count})`}
      </span>
    </span>
  );
}
