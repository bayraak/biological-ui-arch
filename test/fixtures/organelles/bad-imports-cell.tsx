// An organelle importing a CELL — direction is inverted (cells contain
// organelles, not the reverse). organelle-dependency must FIRE on the flat path.
import { SomeCell } from '../cells/some-cell'

export function BadOrganelle() {
  return <SomeCell />
}
