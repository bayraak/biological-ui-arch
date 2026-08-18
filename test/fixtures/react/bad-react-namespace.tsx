import * as React from 'react'

// Breaches no-react-namespace: `React.useState` uses the React.* namespace.
// The rule wants a named import — `import { useState } from 'react'`.
export function BadReactNamespace() {
  const [open] = React.useState(false)
  return open ? 'open' : 'closed'
}
