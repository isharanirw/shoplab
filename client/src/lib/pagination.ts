export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * Page numbers to show: always the first and last page and up to `siblings` pages on each side
 * of the current one, with an ellipsis where pages are skipped. Short ranges are shown in full.
 */
export function pageWindow(current: number, totalPages: number, siblings = 1): PageItem[] {
  if (totalPages <= 0) return [];
  const maxFull = siblings * 2 + 5;
  if (totalPages <= maxFull) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const left = Math.max(current - siblings, 2);
  const right = Math.min(current + siblings, totalPages - 1);
  const items: PageItem[] = [1];
  if (left > 2) items.push('ellipsis-start');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);
  return items;
}

export function totalPagesOf(total: number, pageSize: number): number {
  return pageSize > 0 ? Math.ceil(total / pageSize) : 0;
}
