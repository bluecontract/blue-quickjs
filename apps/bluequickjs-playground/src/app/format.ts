export function formatGas(value: string | bigint): string {
  const raw = typeof value === 'bigint' ? value.toString() : value;
  return Number(raw).toLocaleString('en-US');
}

export function shortenHash(value: string | null, size = 8): string {
  if (!value) {
    return '—';
  }
  if (value.length <= size * 2) {
    return value;
  }
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatStage(stage: string): string {
  return stage.replace(/[-_]/g, ' ');
}

export function slugToLabel(value: string): string {
  return value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
