import type { EventCandidate, NearMatchCandidate } from "@fresno-events/shared";
import {
  formatTitleSimilarityLabel,
  isNearCrossSourceTitleMatch,
  sameNormalizedVenue,
  samePacificShowDate,
  scoreTitleSimilarity
} from "@fresno-events/shared";

import { toLinkedCandidate } from "@/routes/review/occurrence.utils";

const NEAR_MATCH_LIMIT = 6;

export function rankNearMatchCandidates(
  anchor: EventCandidate,
  pool: EventCandidate[],
  linkedIds: Set<string>
): NearMatchCandidate[] {
  const ranked: NearMatchCandidate[] = [];

  for (const row of pool) {
    if (row.id === anchor.id) {
      continue;
    }
    if (row.status === "duplicate") {
      continue;
    }
    if (row.occurrenceId === anchor.occurrenceId) {
      continue;
    }
    if (linkedIds.has(row.id)) {
      continue;
    }
    if (!sameNormalizedVenue(anchor.venueName, row.venueName)) {
      continue;
    }
    if (!samePacificShowDate(anchor.startTs, row.startTs)) {
      continue;
    }

    const similarity = scoreTitleSimilarity(anchor.title, row.title);
    if (!isNearCrossSourceTitleMatch(similarity)) {
      continue;
    }

    const linked = toLinkedCandidate(row);
    ranked.push({
      ...linked,
      titleSimilarityScore: similarity.score,
      sharedWordCount: similarity.sharedCount,
      similarityLabel: formatTitleSimilarityLabel(similarity),
      sharedWords: similarity.sharedWords
    });
  }

  return ranked
    .sort((a, b) => {
      if (b.titleSimilarityScore !== a.titleSimilarityScore) {
        return b.titleSimilarityScore - a.titleSimilarityScore;
      }
      return b.sharedWordCount - a.sharedWordCount;
    })
    .slice(0, NEAR_MATCH_LIMIT);
}
