// Breaches molecule-atoms-only: a molecule is an inert combination of ATOMS —
// importing a higher-level cell makes it stateful (that's a cell, not a molecule).
import { ProductCell } from '../cells/product'

export function BadCellImport() {
  return <ProductCell />
}
