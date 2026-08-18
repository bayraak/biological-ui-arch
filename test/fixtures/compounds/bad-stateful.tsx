// Breaches compound-must-be-stateless: a compound is pure props-in / JSX-out —
// no hooks. If you need state, this is a cell or an organelle.
import { useState } from 'react'

export function BadStateful() {
  const [open] = useState(false)
  return open ? 'a' : 'b'
}
