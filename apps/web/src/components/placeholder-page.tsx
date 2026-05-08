import { motion } from "framer-motion";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: string[];
}

export function PlaceholderPage({ eyebrow, title, description, actions = [] }: PlaceholderPageProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card p-5 shadow-soft sm:p-12 lg:p-16"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--color-gold-haze),transparent_34rem),radial-gradient(circle_at_bottom_right,var(--color-citrus-glow),transparent_28rem)] opacity-35" />
      <div className="max-w-3xl">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.26em] text-accent sm:tracking-[0.32em]">{eyebrow}</p>
        <h1 className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.052em] text-foreground sm:text-7xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{description}</p>
        {actions.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((action) => (
              <span key={action} className="rounded-full border border-border bg-background/65 px-4 py-2 text-sm font-medium text-foreground">
                {action}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
