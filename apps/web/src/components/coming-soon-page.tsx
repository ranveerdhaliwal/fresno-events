export function ComingSoonPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col justify-between rounded-[2.25rem] border border-border/70 bg-card p-6 shadow-float sm:p-10 lg:p-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight">What Up Fresno</p>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Central Valley</p>
          </div>
          <span className="rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Coming soon
          </span>
        </div>

        <div className="my-16 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Fresno events, one clean feed</p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.058em] text-foreground sm:text-7xl">
            Find the good stuff without checking every calendar in town.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            We are building a local event guide for concerts, family days, food pop-ups, art, sports, festivals, and community nights across Fresno and the Central Valley.
          </p>
        </div>

        <div className="grid gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground sm:grid-cols-3">
          <p>Curated listings before they go live.</p>
          <p>Source and ticket links kept visible.</p>
          <p>Designed first for quick mobile browsing.</p>
        </div>
      </section>
    </main>
  );
}
