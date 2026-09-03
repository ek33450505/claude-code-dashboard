/**
 * Shared model badge utilities for consistent model labeling across the UI.
 * Live model ids (CAST v9.0.0): claude-fable-5, claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001
 */

// Deliberately separate model-IDENTITY palette (fuchsia/orange/sky/indigo) — do NOT
// reuse StatusPill.tsx's TONE semantic-state palette (emerald/amber/rose/violet/accent).
export function modelBadgeClasses(model: string): string {
  if (model?.includes('fable'))  return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30'
  if (model?.includes('haiku'))  return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
  if (model?.includes('sonnet')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  if (model?.includes('opus'))   return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
}
