/**
 * Deterministic editorial priority rules for admin triage (no LLM).
 * First matching rule wins. Returns null when no rule applies.
 *
 * @typedef {object} TriageCandidateRow
 * @property {string} id
 * @property {string} title
 * @property {string} venue_name
 * @property {string} source
 * @property {number | null} suggested_priority
 * @property {string} status
 *
 * @typedef {{ priority: number; ruleId: string; ruleLabel: string }} TriageSuggestion
 */

/** @param {string} value */
function blob(value) {
  return value.toLowerCase();
}

/** @param {TriageCandidateRow} row */
function titleVenueBlob(row) {
  return blob(`${row.title} ${row.venue_name}`);
}

/** @param {TriageCandidateRow} row */
function isFresnoGrizzliesHome(row) {
  const text = titleVenueBlob(row);
  return /chukchansi|save mart|grizzlies/.test(text);
}

/** @param {TriageCandidateRow} row */
function isAwayMinorLeagueBaseball(row) {
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
    ) || (row.source === "ticketmaster" && /\bvs\.?\b/.test(row.title) && /ballpark|stadium/.test(text))
  );
}

/** @type {Array<{ id: string; label: string; priority: number; match: (row: TriageCandidateRow) => boolean }>} */
export const EDITORIAL_PRIORITY_RULES = [
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
    match: (row) => /speed dating|meet up|meetup|networking workshop|home repair workshop/i.test(titleVenueBlob(row))
  },
  {
    id: "summer-camp-clinic",
    label: "Summer camp / clinic",
    priority: 5,
    match: (row) =>
      /\bcamp\b|clinic\b|professional development|soccer camp|badminton camp|basketball camp/i.test(titleVenueBlob(row))
  }
];

/** @param {TriageCandidateRow} row @returns {TriageSuggestion | null} */
export function suggestEditorialPriority(row) {
  for (const rule of EDITORIAL_PRIORITY_RULES) {
    if (rule.match(row)) {
      return { priority: rule.priority, ruleId: rule.id, ruleLabel: rule.label };
    }
  }
  return null;
}

/** @param {TriageCandidateRow} row */
export function currentSuggestedPriority(row) {
  if (typeof row.suggested_priority === "number" && Number.isInteger(row.suggested_priority)) {
    return row.suggested_priority;
  }
  return 5;
}
