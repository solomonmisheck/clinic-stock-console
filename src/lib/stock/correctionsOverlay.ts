/**
 * DummyJSON's PUT /products/{id} is a simulation: it echoes the payload back with a
 * 200, but a subsequent GET returns the original, unmodified record (verified by hand
 * against the live API while designing this -- see README "mock API limitations").
 * For a stock-count correction tool that is a serious problem: a supplies clerk who
 * corrects a count, gets a success toast, then reloads the tablet would see the *old*
 * number come back with no indication anything reverted.
 *
 * We paper over that with a small local overlay: successful corrections are recorded
 * here (per item id, with a timestamp) and merged on top of whatever the API returns,
 * so the corrected value survives a reload on the same device. This is explicitly a
 * workaround for a read-only mock, not a substitute for a real backend -- the detail
 * page surfaces a "saved on this device only" note so nobody mistakes it for a
 * synced, multi-device correction (the brief's own scenario has colleagues opening
 * the same link on different machines, and this will *not* travel with the link).
 */

const STORAGE_KEY = 'clinic-stock.corrections';

export interface StockCorrection {
  stock: number;
  correctedAt: string;
}

type CorrectionsMap = Record<string, StockCorrection>;

function readAll(): CorrectionsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CorrectionsMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: CorrectionsMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getCorrection(id: number): StockCorrection | undefined {
  return readAll()[String(id)];
}

export function saveCorrection(id: number, stock: number): StockCorrection {
  const map = readAll();
  const entry: StockCorrection = { stock, correctedAt: new Date().toISOString() };
  map[String(id)] = entry;
  writeAll(map);
  return entry;
}

/** Merge any locally-saved corrections over a freshly-fetched product list. */
export function applyCorrections<T extends { id: number; stock: number }>(products: T[]): T[] {
  const map = readAll();
  if (Object.keys(map).length === 0) return products;
  return products.map((product) => {
    const correction = map[String(product.id)];
    return correction ? { ...product, stock: correction.stock } : product;
  });
}
