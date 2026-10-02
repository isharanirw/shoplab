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

/** The rating shown as stars. The accessible name carries the same information in words. */
export function StarRating({ rating, showCount = true, ariaLabel }: StarRatingProps) {
  if (rating.average === null) {
    return <span className={styles.noRating}>No reviews yet</span>;
  }
  const label = `Rated ${rating.average.toFixed(1)} out of 5 from ${pluralise(rating.count, 'review')}`;
  return (
    <shoplab-stars
      role="img"
      aria-label={ariaLabel ?? label}
      value={String(rating.average)}
      count={String(rating.count)}
      show-count={showCount ? 'true' : 'false'}
    />
  );
}
