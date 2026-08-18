export function GoodIterated({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i} className="font-primary text-[12px] leading-[16px] font-bold">{i}</li>
      ))}
    </ul>
  )
}
