import { Button } from '../atoms/button'

// A clean compound: composes a lower-level atom, no store / higher-level import.
export function GoodCompound() {
  return <Button />
}
