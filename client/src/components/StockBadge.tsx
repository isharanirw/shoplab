import { stockLabel, stockLevel } from '../lib/variants';
import styles from './ProductParts.module.css';

export function StockBadge({ stock }: { stock: number }) {
  const level = stockLevel(stock);
  const cls = level === 'out' ? styles.badgeOut : level === 'low' ? styles.badgeLow : styles.badgeIn;
  return (
    <span className={`${styles.badge} ${cls}`} data-testid="stock-badge">
      {stockLabel(stock)}
    </span>
  );
}
