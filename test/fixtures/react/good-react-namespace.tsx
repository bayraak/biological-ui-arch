import { useState } from 'react'

// Clean: a named `useState` import, no React.* namespace access.
export function GoodReactNamespace() {
  const [open] = useState(false)
  return open ? 'open' : 'closed'
}
