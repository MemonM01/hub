export function ComingSoon({ title, step }: { title: string; step: number }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Arrives in build step {step}.</p>
    </section>
  )
}
