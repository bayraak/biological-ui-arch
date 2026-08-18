const COLOR_MAP = { a: 'x', b: 'y' }
function privateHelper(n: number) {
  return n * 2
}
export function GoodOneExport() {
  return <div data-testid="g">{privateHelper(COLOR_MAP.a.length)}</div>
}
export function GoodOneExportRed() {
  return <GoodOneExport />
}
