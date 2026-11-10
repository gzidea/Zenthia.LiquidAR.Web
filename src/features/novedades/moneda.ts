/** Display only: round decimal strings without losing precision through Number. */
export function formatMoneda(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return '—';
  const fraction = (match[3] ?? '').padEnd(4, '0');
  let thousandths = BigInt(match[2]!) * 1000n + BigInt(fraction.slice(0, 3));
  if (fraction.charAt(3) >= '5') thousandths += 1n;
  const integer = (thousandths / 1000n).toLocaleString('es-AR');
  const decimals = (thousandths % 1000n).toString().padStart(3, '0');
  const sign = match[1] && thousandths !== 0n ? '-' : '';
  return `$ ${sign}${integer},${decimals}`;
}
