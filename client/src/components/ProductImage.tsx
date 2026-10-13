import { imageAlt, imageAt, resolveImages } from '../lib/productImages';
import type { ImageSource } from '../lib/productImages';
import styles from './ProductParts.module.css';

interface ProductImageProps {
  /** The product (or cart line, order line) to show: its name, `images`, `imagePath` and `category`. */
  item: ImageSource & { name: string };
  /** Zero-based picture number in the gallery. */
  index?: number;
  /** Decorative pictures are hidden from assistive technology (the name is written next to them). */
  decorative?: boolean;
  /** Load straight away (the main picture or the first row) instead of lazily. */
  priority?: boolean;
}

/**
 * One product picture: a self-hosted image (an uploaded one, a generated illustration, or a category illustration).
 * Width, height and an aspect ratio are set so the page does not move while it loads.
 */
export function ProductImage({ item, index = 0, decorative = false, priority = false }: ProductImageProps) {
  const urls = resolveImages(item);
  const shown = urls[index] === undefined ? 0 : index;
  return (
    <img
      className={styles.image}
      src={imageAt(urls, shown)}
      alt={decorative ? '' : imageAlt(item.name, shown, urls.length)}
      width={400}
      height={400}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-image-index={shown + 1}
    />
  );
}
