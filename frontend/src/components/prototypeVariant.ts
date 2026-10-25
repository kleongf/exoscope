// PROTOTYPE (prototype/turn-ui): read the `?variant=` search param.
export function readVariant(keys: string[]): string {
  const v = new URLSearchParams(window.location.search).get("variant") ?? keys[0] ?? "";
  return keys.includes(v) ? v : (keys[0] ?? "");
}
