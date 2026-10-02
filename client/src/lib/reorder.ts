/** Moves the item at `from` so it ends up at index `to`. Returns the same array when nothing changes or an index is out of range. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

/** The sentence announced to screen readers after a move, for example "Moved Football to position 2 of 5." */
export function moveAnnouncement(name: string, position: number, total: number): string {
  return `Moved ${name} to position ${position} of ${total}.`;
}
