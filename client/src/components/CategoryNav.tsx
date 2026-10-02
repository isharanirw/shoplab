import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCategories } from './CategoriesContext';
import styles from './CategoryNav.module.css';

/** Query string for a category or one of its subcategories on the listing page. */
export function categoryHref(category: string, subcategory?: string): string {
  const params = new URLSearchParams({ category });
  if (subcategory) params.set('subcategory', subcategory);
  return `/products?${params.toString()}`;
}

interface CategoryNavProps {
  /** Called when a link is followed, so the mobile drawer can close. */
  onNavigate: () => void;
}

/**
 * The category menu. On desktop each category opens a panel of subcategories on hover or keyboard
 * focus (a mega-menu); on a narrow screen the same links sit in the hamburger drawer.
 */
export function CategoryNav({ onNavigate }: CategoryNavProps) {
  const categories = useCategories();
  const [openName, setOpenName] = useState<string | null>(null);

  if (categories.status === 'loading') {
    return (
      <p role="status" className={styles.message}>
        Loading categories...
      </p>
    );
  }
  if (categories.status === 'error') {
    return (
      <div role="alert" className={styles.message}>
        <span>Categories could not be loaded. </span>
        <button type="button" className="btn btn-small" onClick={categories.retry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      <li className={styles.item}>
        <NavLink to="/products" end className={styles.link} onClick={onNavigate}>
          All products
        </NavLink>
      </li>
      {categories.data.data.map((category) => {
        const isOpen = openName === category.name;
        return (
          <li
            key={category.name}
            className={isOpen ? `${styles.item} ${styles.itemOpen}` : styles.item}
            onMouseEnter={() => setOpenName(category.name)}
            onMouseLeave={() => setOpenName(null)}
            onFocus={() => setOpenName(category.name)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenName(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpenName(null);
            }}
          >
            <Link
              to={categoryHref(category.name)}
              className={styles.link}
              onClick={() => {
                setOpenName(null);
                onNavigate();
              }}
            >
              {category.name}
            </Link>
            <div className={styles.panel} role="group" aria-label={`${category.name} subcategories`}>
              <ul className={styles.subList}>
                {category.subcategories.map((sub) => (
                  <li key={sub.name}>
                    <Link
                      to={categoryHref(category.name, sub.name)}
                      className={styles.subLink}
                      onClick={() => {
                        setOpenName(null);
                        onNavigate();
                      }}
                    >
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
