export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 8 });
