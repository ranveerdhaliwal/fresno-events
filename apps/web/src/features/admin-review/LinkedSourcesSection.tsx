import { ExternalLink } from "lucide-react";

import type { LinkedEventCandidate } from "@fresno-events/shared";

export function LinkedSourcesSection({ linkedCandidates }: { linkedCandidates: LinkedEventCandidate[] }) {
  if (linkedCandidates.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Also listed on</h3>
      <ul className="mt-3 space-y-2">
        {linkedCandidates.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-neutral-100">{row.title}</p>
              <p className="text-xs text-neutral-500">
                {row.source} · {row.status}
              </p>
            </div>
            {row.sourceUrl ? (
              <a
                href={row.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-amber-300/70"
              >
                Source <ExternalLink className="size-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
