import styles from './ProductParts.module.css';

interface ProductImageProps {
  productId: number;
  name: string;
  /** Zero-based image number; each one draws a different shape so a gallery swap is visible. */
  index?: number;
  /** Decorative images are hidden from assistive technology (the name is shown next to them). */
  decorative?: boolean;
  total?: number;
}

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return letters || '?';
}

/**
 * A self-hosted placeholder drawn in SVG. The colour comes from the product ID and the
 * shape from the image number, so every product and every gallery picture looks different.
 */
export function ProductImage({ productId, name, index = 0, decorative = false, total = 3 }: ProductImageProps) {
  const hue = (productId * 47 + index * 29) % 360;
  const bg = `hsl(${hue} 55% 90%)`;
  const shape = `hsl(${hue} 45% 62%)`;
  const ink = `hsl(${hue} 60% 20%)`;
  const label = `${name}, image ${index + 1} of ${total}`;
  return (
    <svg
      className={styles.image}
      viewBox="0 0 400 400"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-image-index={index + 1}
    >
      <rect width="400" height="400" fill={bg} />
      {index % 3 === 0 && <circle cx="200" cy="170" r="105" fill={shape} />}
      {index % 3 === 1 && <rect x="95" y="65" width="210" height="210" rx="24" fill={shape} />}
      {index % 3 === 2 && <polygon points="200,60 310,170 200,280 90,170" fill={shape} />}
      <text x="200" y="195" textAnchor="middle" fontSize="72" fontWeight="700" fill={ink} fontFamily="system-ui, sans-serif">
        {initials(name)}
      </text>
      <text x="200" y="350" textAnchor="middle" fontSize="28" fill={ink} fontFamily="system-ui, sans-serif">
        Image {index + 1}
      </text>
    </svg>
  );
}
