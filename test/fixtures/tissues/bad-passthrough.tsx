export function BadPassthrough({ children }: { children: unknown }) {
  return <div>{children as never}</div>
}
