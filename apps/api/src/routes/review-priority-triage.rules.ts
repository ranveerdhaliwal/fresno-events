export interface TriageCandidateRow {
  id: string;
  title: string;
  venue_name: string;
  source: string;
  suggested_priority: number | null;
  status: string;
}

export interface TriageSuggestion {
  priority: number;
  ruleId: string;
  ruleLabel: string;
}

export interface PriorityTriageRule {
  id: string;
  label: string;
  priority: number;
  match: (row: TriageCandidateRow) => boolean;
}

function titleVenueBlob(row: TriageCandidateRow): string {
  return `${row.title} ${row.venue_name}`.toLowerCase();
}

function isFresnoGrizzliesHome(row: TriageCandidateRow): boolean {
  const text = titleVenueBlob(row);
  return /chukchansi|save mart|grizzlies/.test(text);
}

function isAwayMinorLeagueBaseball(row: TriageCandidateRow): boolean {
  if (!/\bvs\.?\b/.test(row.title)) {
    return false;
  }
  if (isFresnoGrizzliesHome(row)) {
    return false;
  }
  const text = titleVenueBlob(row);
  return (
    /rawhide|stockton ports|san jose giants|modesto nuts|inland empire|lake elsinore|rancho cucamonga|visalia/.test(
      text
    ) ||
    (row.source === "ticketmaster" && /\bvs\.?\b/.test(row.title) && /ballpark|stadium/.test(text))
  );
}

export const EDITORIAL_PRIORITY_RULES: readonly PriorityTriageRule[] = [
  {
    id: "miss-california-pageant",
    label: "Miss California pageant",
    priority: 2,
    match: (row) => /\bmiss california\b/i.test(row.title)
  },
  {
    id: "ringling-circus",
    label: "Ringling / Barnum circus (Save Mart draw)",
    priority: 1,
    match: (row) => /ringling|barnum\s*&?\s*bailey|greatest show on earth/i.test(row.title)
  },
  {
    id: "monster-jam-save-mart",
    label: "Monster Jam @ Save Mart",
    priority: 1,
    match: (row) => /\bmonster jam\b/i.test(row.title) && /save mart|chukchansi/i.test(row.venue_name)
  },
  {
    id: "fresno-flea-market",
    label: "Fresno Flea Market (fairgrounds recurring)",
    priority: 5,
    match: (row) => /\bfresno flea market\b/i.test(row.title)
  },
  {
    id: "big-fresno-fair-routine",
    label: "Big Fresno Fair routine / grounds listing",
    priority: 5,
    match: (row) => {
      const text = titleVenueBlob(row);
      return /big fresno fair/i.test(row.venue_name) && /museum|flea market|farmers market/.test(text);
    }
  },
  {
    id: "away-minor-league",
    label: "Away / non-Grizzlies minor-league baseball",
    priority: 5,
    match: isAwayMinorLeagueBaseball
  },
  {
    id: "lds-ward-activity",
    label: "LDS / ward community activity",
    priority: 5,
    match: (row) =>
      /church of jesus christ|single adult potluck|ysa fhe|english connect|ward youth activity|friday night ysa sports/i.test(
        titleVenueBlob(row)
      )
  },
  {
    id: "crest-film-screening",
    label: "Historic Crest film screening",
    priority: 4,
    match: (row) =>
      /film screening|screenig/i.test(row.title) && /historic crest|crest theatre/i.test(row.venue_name)
  },
  {
    id: "speed-dating-meetup",
    label: "Speed dating / small meetup",
    priority: 5,
    match: (row) =>
      /speed dating|meet up|meetup|networking workshop|home repair workshop/i.test(titleVenueBlob(row))
  },
  {
    id: "summer-camp-clinic",
    label: "Summer camp / clinic",
    priority: 5,
    match: (row) =>
      /\bcamp\b|clinic\b|professional development|soccer camp|badminton camp|basketball camp/i.test(
        titleVenueBlob(row)
      )
  }
];

export function suggestEditorialPriority(row: TriageCandidateRow): TriageSuggestion | null {
  for (const rule of EDITORIAL_PRIORITY_RULES) {
    if (rule.match(row)) {
      return { priority: rule.priority, ruleId: rule.id, ruleLabel: rule.label };
    }
  }
  return null;
}

export function currentSuggestedPriority(row: TriageCandidateRow): number {
  if (typeof row.suggested_priority === "number" && Number.isInteger(row.suggested_priority)) {
    return row.suggested_priority;
  }
  return 5;
}
