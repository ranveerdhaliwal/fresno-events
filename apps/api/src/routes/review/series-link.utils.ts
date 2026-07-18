import {
  computeAdHocSeriesId,
  type EventCandidate,
  type NormalizedEvent,
  type SeriesSiblingCandidate
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { fetchCandidatesBySeriesId, getCandidate, updateCandidate } from "@/routes/review/candidate.service";
import { ReviewRouteError } from "@/routes/review/errors";
import { toSeriesSiblingCandidate } from "@/routes/review/series.utils";

function withoutSeriesFields(event: NormalizedEvent): NormalizedEvent {
  const {
    seriesId: _seriesId,
    seriesName: _seriesName,
    seriesListingRecId: _seriesListingRecId,
    seriesPresentedBy: _seriesPresentedBy,
    ...rest
  } = event;
  return rest;
}

export async function resolveSeriesSiblingsForCandidate(
  env: Env,
  candidate: EventCandidate
): Promise<SeriesSiblingCandidate[]> {
  const seriesId = candidate.normalizedEvent.seriesId;
  if (!seriesId) {
    return [];
  }

  return (await fetchCandidatesBySeriesId(env, seriesId, candidate.id)).map(toSeriesSiblingCandidate);
}

export async function linkCandidatesAsSeries(
  env: Env,
  primaryId: string,
  otherCandidateId: string
): Promise<{ primary: EventCandidate; linked: number }> {
  if (primaryId === otherCandidateId) {
    throw new ReviewRouteError("Cannot link a candidate to itself.", 400);
  }

  const [primary, other] = await Promise.all([
    getCandidate(env, primaryId),
    getCandidate(env, otherCandidateId)
  ]);

  if (!primary || !other) {
    throw new ReviewRouteError("One or both candidates could not be found.", 404);
  }

  const seriesId =
    primary.normalizedEvent.seriesId ??
    other.normalizedEvent.seriesId ??
    (await computeAdHocSeriesId({
      source: primary.source,
      title: primary.title,
      venueName: primary.venueName
    }));

  const patchSeries = (event: NormalizedEvent): NormalizedEvent => ({
    ...event,
    seriesId,
    ...(primary.normalizedEvent.seriesName && !event.seriesName
      ? { seriesName: primary.normalizedEvent.seriesName }
      : {}),
    ...(primary.normalizedEvent.seriesListingRecId && !event.seriesListingRecId
      ? { seriesListingRecId: primary.normalizedEvent.seriesListingRecId }
      : {})
  });

  const updatedPrimary = await updateCandidate(env, primary.id, {
    normalized_event: patchSeries(primary.normalizedEvent)
  });
  const updatedOther = await updateCandidate(env, other.id, {
    normalized_event: patchSeries(other.normalizedEvent)
  });

  if (!updatedPrimary || !updatedOther) {
    throw new ReviewRouteError("Series link could not be saved.", 500);
  }

  const existingSiblings = await fetchCandidatesBySeriesId(env, seriesId, primary.id, { limit: 50 });
  let linked = 2;
  for (const sibling of existingSiblings) {
    if (sibling.id === other.id) {
      continue;
    }
    await updateCandidate(env, sibling.id, {
      normalized_event: patchSeries(sibling.normalizedEvent)
    });
    linked += 1;
  }

  return { primary: updatedPrimary, linked };
}

export async function unlinkCandidateFromSeries(
  env: Env,
  candidateId: string
): Promise<EventCandidate> {
  const candidate = await getCandidate(env, candidateId);
  if (!candidate) {
    throw new ReviewRouteError("That event candidate could not be found.", 404);
  }

  if (!candidate.normalizedEvent.seriesId) {
    return candidate;
  }

  const updated = await updateCandidate(env, candidateId, {
    normalized_event: withoutSeriesFields(candidate.normalizedEvent)
  });

  if (!updated) {
    throw new ReviewRouteError("Series link could not be removed.", 500);
  }

  return updated;
}
