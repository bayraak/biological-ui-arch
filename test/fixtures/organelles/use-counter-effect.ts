import { useEffect, useState } from 'react'

// Clean: a side-effectful hook in a *-effect.ts file with an *Effect-suffixed
// export — the convention that makes it identifiable. effect-hook-naming exempts it.
export function useCounterEffect() {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(1)
  }, [])
  return n
}
