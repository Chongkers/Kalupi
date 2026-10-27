// The order presets show in (dashboard Quick add, Add entry, Settings → Presets), picked in Settings → Presets.

export const PRESET_ORDERS = {
  frequent: "Most frequent",
  latest: "Latest added",
  first: "First added",
} as const;
export type PresetOrder = keyof typeof PRESET_ORDERS;

export const DEFAULT_PRESET_ORDER: PresetOrder = "frequent";

export function isPresetOrder(value: unknown): value is PresetOrder {
  return typeof value === "string" && value in PRESET_ORDERS;
}

/**
 * Presets in the picked order. "Most frequent" counts the entries logged from each one: logging a
 * preset saves its name as the entry's note (logPreset), so renaming a preset starts its count over.
 * Ties, and presets never used, go newest first.
 */
export function orderPresets<P extends { name: string; created_at: string }>(
  presets: P[],
  order: PresetOrder,
  transactions: { source: string; note: string | null }[],
): P[] {
  const byAge = [...presets].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (order === "first") return byAge;
  if (order === "latest") return byAge.reverse();

  const uses = new Map<string, number>();
  for (const t of transactions) {
    if (t.source === "preset" && t.note) uses.set(t.note, (uses.get(t.note) ?? 0) + 1);
  }
  return byAge.reverse().sort((a, b) => (uses.get(b.name) ?? 0) - (uses.get(a.name) ?? 0));
}
