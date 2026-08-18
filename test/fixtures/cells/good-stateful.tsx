import { useState } from 'react'

// A genuine cell: it OWNS state (a useState hook). cell-must-be-stateful must
// stay silent here — this is the living unit the cell tier is for.
export function GoodStateful() {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(!open)} type="button">
      {open ? 'on' : 'off'}
    </button>
  )
}
