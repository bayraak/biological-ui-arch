import { useState } from 'react'
export function GoodHooksPart() {
  const [open, setOpen] = useState(false)
  return <button onClick={() => setOpen(!open)}>{String(open)}</button>
}
