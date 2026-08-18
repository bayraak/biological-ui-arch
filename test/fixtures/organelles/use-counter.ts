import { useEffect, useState } from 'react'

// Breaches effect-hook-naming: uses useEffect but the file is not named *-effect.ts
// and the hook export does not end in *Effect — side-effectful hooks must be
// immediately identifiable by name.
export function useCounter() {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(1)
  }, [])
  return n
}
