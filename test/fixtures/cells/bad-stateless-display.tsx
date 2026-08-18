// A stateless props-in/JSX-out display with no hook, no organelle, no store, and
// no state-bearing sibling. It is "inert chemistry" filed in the cell tier —
// cell-must-be-stateful must fire and push it down to compounds/.
export function BadStatelessDisplay({ label }: { label: string }) {
  return <div className="badge">{label}</div>
}
