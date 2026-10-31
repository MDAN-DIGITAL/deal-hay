export const DATA_CHANGED = "dealhay:data-changed"
export function invalidateQueries(): void {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(DATA_CHANGED))
}
