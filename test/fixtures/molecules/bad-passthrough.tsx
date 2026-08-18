import { Button } from '../atoms/button'

// Breaches molecule-must-compose: imports an atom but NEVER renders it (fake
// composition / lint-theater) — renders only a raw <div>. A molecule is by
// definition a combination; it must actually render an atom/molecule.
export function BadPassthrough() {
  return <div>nothing composed</div>
}
