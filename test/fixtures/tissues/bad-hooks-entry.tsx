import { useState } from 'react'
import { GoodHooksPart } from './good-hooks.parts'
export function BadHooksEntry() {
  const [n, setN] = useState(0)
  return <GoodHooksPart key={n} />
}
