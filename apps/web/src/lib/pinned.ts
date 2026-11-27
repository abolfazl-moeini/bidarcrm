/**
 * BidarCRM - Pinned Items Service (GAP-08)
 *
 * Backed by localStorage ('bidar_pinned_items') up to 10 items.
 * Allows quick access to favorite deals, contacts, accounts, and leads across the app.
 */

export interface PinnedItem {
  id: string;
  type: 'deal' | 'contact' | 'account' | 'lead';
  title: string;
  subtitle?: string;
  url: string;
  pinnedAt: string;
}

const STORAGE_KEY = 'bidar_pinned_items';
const MAX_PINNED = 10;

export function getPinnedItems(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isItemPinned(id: string): boolean {
  const items = getPinnedItems();
  return items.some((item) => item.id === id);
}

export function togglePinItem(item: Omit<PinnedItem, 'pinnedAt'>): boolean {
  if (typeof window === 'undefined') return false;
  const items = getPinnedItems();
  const index = items.findIndex((i) => i.id === item.id);
  let updated: PinnedItem[];
  let isPinnedNow = false;

  if (index !== -1) {
    updated = items.filter((i) => i.id !== item.id);
    isPinnedNow = false;
  } else {
    const newItem: PinnedItem = {
      ...item,
      pinnedAt: new Date().toISOString(),
    };
    updated = [newItem, ...items].slice(0, MAX_PINNED);
    isPinnedNow = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('bidar:pinned_updated', { detail: { items: updated } }));
  } catch {
    // Ignore quota errors
  }

  return isPinnedNow;
}

export function removePinnedItem(id: string): void {
  if (typeof window === 'undefined') return;
  const items = getPinnedItems().filter((i) => i.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('bidar:pinned_updated', { detail: { items } }));
  } catch {
    // Ignore
  }
}
