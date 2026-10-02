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
  /** Category whose panel is open from hover or keyboard focus (desktop). */
  const [openName, setOpenName] = useState<string | null>(null);
  /** Category expanded with its + button (the mobile drawer). */
  const [expandedName, setExpandedName] = useState<string | null>(null);

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
        const isHovered = openName === category.name;
        const isExpanded = expandedName === category.name;
        const classes = [styles.item, isHovered ? styles.itemOpen : '', isExpanded ? styles.itemExpanded : ''].join(' ');
        const follow = () => {
          setOpenName(null);
          setExpandedName(null);
          onNavigate();
        };
        return (
          <li
            key={category.name}
            className={classes}
            onMouseEnter={() => setOpenName(category.name)}
            onMouseLeave={() => setOpenName(null)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenName(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpenName(null);
            }}
          >
            <div className={styles.row}>
              <Link
                to={categoryHref(category.name)}
                className={styles.link}
                onFocus={() => setOpenName(category.name)}
                onClick={follow}
              >
                {category.name}
              </Link>
              <button
                type="button"
                className={`btn btn-small ${styles.toggle}`}
                aria-expanded={isExpanded}
                aria-label={`${category.name} subcategories`}
                onClick={() => setExpandedName(isExpanded ? null : category.name)}
              >
                <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
              </button>
            </div>
            <div className={styles.panel} role="group" aria-label={`${category.name} subcategories`}>
              <ul className={styles.subList}>
                {category.subcategories.map((sub) => (
                  <li key={sub.name}>
                    <Link to={categoryHref(category.name, sub.name)} className={styles.subLink} onClick={follow}>
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
