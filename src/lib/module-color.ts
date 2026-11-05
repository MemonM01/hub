// Each module gets its own colour, used everywhere that module appears.
const PALETTE = ['#2f6fb0', '#2e8b57', '#b7791f', '#7c5cc4', '#0e7c86', '#b33f62']

export function moduleColors(codes: string[]): Map<string, string> {
  return new Map([...codes].sort().map((c, i) => [c, PALETTE[i % PALETTE.length]]))
}
