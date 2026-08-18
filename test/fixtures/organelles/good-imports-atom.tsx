// An organelle importing an ATOM — allowed. organelle-dependency must NOT fire.
import { Button } from '../atoms/button'

export function GoodOrganelle() {
  return <Button />
}
