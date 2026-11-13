/** "PRIMARY_SOURCE" -> "Primary source", for enum values shown as labels (sentence case, §5.3). */
export function humanise(value: string): string {
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
