import { CalendarDays } from "lucide-react";

import type { SeriesSiblingCandidate } from "@fresno-events/shared";

import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

interface SeriesSectionProps {
  seriesId: string;
  seriesName?: string;
  seriesListingRecId?: string;
  seriesPresentedBy?: string;
  seriesSiblings: SeriesSiblingCandidate[];
}

export function SeriesSection({
  seriesId,
  seriesName,
  seriesListingRecId,
  seriesPresentedBy,
  seriesSiblings
}: SeriesSectionProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Series</h3>
      <div className="mt-2 space-y-1 text-sm text-neutral-300">
        {seriesName ? <p>{seriesName}</p> : null}
        {seriesPresentedBy ? (
          <p className="text-xs text-neutral-500">Presented by: {seriesPresentedBy}</p>
        ) : null}
        <p className="break-all font-mono text-xs text-neutral-600">{seriesId}</p>
        {seriesListingRecId ? (
          <p className="text-xs text-neutral-600">recid: {seriesListingRecId}</p>
        ) : null}
      </div>
      {seriesSiblings.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {seriesSiblings.map((sib) => (
            <li
              key={sib.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-100">{sib.title}</p>
                <p className="flex items-center gap-1 text-xs text-neutral-500">
                  <CalendarDays className="h-3 w-3" />
                  {formatPacificDateTimeLabel(sib.startTs)} · {sib.venueName}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
