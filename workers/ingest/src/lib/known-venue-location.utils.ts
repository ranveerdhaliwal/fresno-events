import type { NormalizedEvent } from "@fresno-events/shared";
import { isValidCoordinate, resolveVenueLocationFields } from "@fresno-events/shared";

type VenueCoords = { venueLat: number; venueLng: number };

type KnownVenueRule = {
  match: (key: string) => boolean;
  mailing: string;
  coords: VenueCoords;
};

function normalizeVenueKey(venueName: string): string {
  return venueName.toLowerCase().replace(/\s+/g, " ").trim();
}

function rule(match: (key: string) => boolean, mailing: string, coords: VenueCoords): KnownVenueRule {
  return { match, mailing, coords };
}

/** Pattern rules for venues whose ingest names vary slightly across sources. */
const VENUE_RULES: KnownVenueRule[] = [
  rule(
    (k) => /\brainbow\b/.test(k) && /\bballroom\b/.test(k),
    "1725 Broadway St, Fresno, CA 93721",
    { venueLat: 36.7402635, venueLng: -119.7994878 }
  ),
  rule((k) => /\bstrummers?\b/.test(k), "833 E Fern Ave, Fresno, CA 93728", {
    venueLat: 36.7589629,
    venueLng: -119.8002377
  }),
  rule((k) => /\bfulton\s*55\b/.test(k), "875 Divisadero St, Fresno, CA 93721", {
    venueLat: 36.7437782,
    venueLng: -119.8005388
  }),
  rule((k) => /\bsave\s*mart\s+center\b/.test(k), "2650 E. Shaw Ave, Fresno, CA 93710", {
    venueLat: 36.8096959,
    venueLng: -119.738519
  }),
  rule((k) => /\btower\s+theatre\b/.test(k), "815 E Olive Ave, Fresno, CA 93728", {
    venueLat: 36.7579827,
    venueLng: -119.8014524
  }),
  rule((k) => /\bchaffee\b/.test(k) && /\bzoo\b/.test(k), "894 W. Belmont Avenue, Fresno, CA 93728", {
    venueLat: 36.7519,
    venueLng: -119.8235
  }),
  rule((k) => /\bsaroyan\b/.test(k), "730 M St, Fresno, CA 93721", {
    venueLat: 36.7347,
    venueLng: -119.7847
  }),
  rule(
    (k) => /\bconvention\s+(?:&\s*)?entertainment\s+center\b/.test(k) || /\bconvention\s+center\b/.test(k),
    "848 M Street, Fresno, CA 93721",
    { venueLat: 36.7346, venueLng: -119.7853 }
  ),
  rule((k) => /\bchukchansi\s+park\b/.test(k) || /\bvalley\s+strong\s+ballpark\b/.test(k), "1800 Tulare St, Fresno, CA 93721", {
    venueLat: 36.7328,
    venueLng: -119.7902
  }),
  rule((k) => /\bwarnors?\b/.test(k), "1400 Fulton St, Fresno, CA 93721", {
    venueLat: 36.7384472,
    venueLng: -119.7945803
  }),
  rule((k) => /\bcmac\b/.test(k), "1555 Van Ness Ave, Fresno, CA 93721", {
    venueLat: 36.7402201,
    venueLng: -119.795774
  }),
  rule((k) => /\barte\s+americas\b/.test(k), "1630 Van Ness Ave, Fresno, CA 93721", {
    venueLat: 36.7411734,
    venueLng: -119.7958592
  }),
  rule((k) => /\btioga[\s-]*sequoia\b/.test(k), "745 Fulton St, Fresno, CA 93721", {
    venueLat: 36.7318,
    venueLng: -119.7871
  }),
  rule((k) => /\bmemorial\s+auditorium\b/.test(k), "2425 Fresno St, Fresno, CA 93721", {
    venueLat: 36.73972,
    venueLng: -119.7875
  }),
  rule((k) => /\bnorth\s+gym\b/.test(k), "5305 N. Campus Drive, Fresno, CA 93740", {
    venueLat: 36.8133,
    venueLng: -119.7412
  }),
  rule((k) => /\bswitch\s+lounge\b/.test(k), "5665 N Blackstone Ave, Fresno, CA 93710", {
    venueLat: 36.8214,
    venueLng: -119.7908
  }),
  rule((k) => /\bon[\s-]*a[\s-]*roll\s+sushi\b/.test(k), "1306 Van Ness Ave, Fresno, CA 93721", {
    venueLat: 36.7394,
    venueLng: -119.7959
  }),
  rule((k) => /\bfresno\s+ideaworks\b/.test(k), "1730 H Street, Fresno, CA 93721", {
    venueLat: 36.7400805,
    venueLng: -119.8001065
  })
];

/** Exact venue names from Visit Fresno / Ticketmaster / Venunite that already include a display label. */
const VENUE_BY_EXACT_NAME: Record<string, { mailing: string; coords: VenueCoords }> = {
  "press box sports (pb1) ne fresno": {
    mailing: "6022 N Figarden Dr, Fresno, CA 93722",
    coords: { venueLat: 36.8233848, venueLng: -119.8696978 }
  },
  "kern st between m and n streets": {
    mailing: "Kern St between M and N Streets, Fresno, CA 93721",
    coords: { venueLat: 36.7361012, venueLng: -119.7852997 }
  },
  "old town clovis": {
    mailing: "Pollasky between 5th and Bullard, Clovis, CA 93612",
    coords: { venueLat: 36.8194467, venueLng: -119.7020549 }
  },
  "woodward park": {
    mailing: "9407 N Fort Washington, Fresno, CA 93720",
    coords: { venueLat: 36.8721, venueLng: -119.7849 }
  },
  "fashion fair mall": {
    mailing: "645 E Shaw Ave, Fresno, CA 93710",
    coords: { venueLat: 36.8065701, venueLng: -119.7767257 }
  },
  "river park farmer's market": {
    mailing: "220 Paseo del Centro, Fresno, CA 93720",
    coords: { venueLat: 36.7377981, venueLng: -119.7871247 }
  },
  "clovis veterans memorial district": {
    mailing: "808 4th Street, Clovis, CA 93612",
    coords: { venueLat: 36.8243539, venueLng: -119.6986866 }
  },
  "the rosé": {
    mailing: "820 Van Ness Ave, Fresno, CA 93721",
    coords: { venueLat: 36.7331718, venueLng: -119.7870177 }
  },
  "the next bar": {
    mailing: "4231 E Shields Ave, Fresno, CA 93726",
    coords: { venueLat: 36.7801259, venueLng: -119.7533038 }
  },
  "crow & wolf brewing company": {
    mailing: "526 Spruce Avenue, Clovis, CA 93611",
    coords: { venueLat: 36.8407625, venueLng: -119.7043663 }
  },
  "maya cinemas": {
    mailing: "3090 E Campus Pointe Dr, Fresno, CA 93710",
    coords: { venueLat: 36.8119807, venueLng: -119.734641 }
  },
  "ramos torres winery": {
    mailing: "1665 Simpson St, Kingsburg, CA 93631",
    coords: { venueLat: 36.5150906, venueLng: -119.5561857 }
  },
  "vineyard farmer's market": {
    mailing: "Northwest Corner of Blackstone and Shaw, Fresno, CA 93710",
    coords: { venueLat: 36.8084559, venueLng: -119.7903245 }
  },
  "rocket dog": {
    mailing: "88 E Shaw Ave., Fresno, CA 93710",
    coords: { venueLat: 36.8088311, venueLng: -119.7884699 }
  },
  "7300 n. fresno street": {
    mailing: "7300 N. Fresno Street, Fresno, CA 93720",
    coords: { venueLat: 36.8428404, venueLng: -119.7811198 }
  },
  "tioga-sequoia brewing company": {
    mailing: "745 Fulton St, Fresno, CA 93721",
    coords: { venueLat: 36.730957, venueLng: -119.7884403 }
  },
  "eaton plaza": {
    mailing: "2400 Fresno St, Fresno, CA 93721",
    coords: { venueLat: 36.738775, venueLng: -119.7881974 }
  },
  "fresno ag hardware": {
    mailing: "4590 N First St, Fresno, CA 93726",
    coords: { venueLat: 36.8004176, venueLng: -119.7706516 }
  },
  "2600 fresno st, fresno, ca 93721, usa": {
    mailing: "2600 Fresno St, Fresno, CA 93721",
    coords: { venueLat: 36.7396038, venueLng: -119.7843193 }
  },
  "tioga-sequoia beer garden": {
    mailing: "745 Fulton St, Fresno, CA 93721",
    coords: { venueLat: 36.7318, venueLng: -119.7871 }
  },
  "dave & buster's": {
    mailing: "212 East River Park Circle, Fresno, CA 93720",
    coords: { venueLat: 36.8549061, venueLng: -119.7864989 }
  },
  "jaswant singh khalra park": {
    mailing: "3861 W Clinton Ave, Fresno, CA 93722",
    coords: { venueLat: 36.7710509, venueLng: -119.8601854 }
  },
  "ten tavern": {
    mailing: "1177 N Willow Ave #108, Fresno, CA 93720",
    coords: { venueLat: 36.8517527, venueLng: -119.7282055 }
  },
  "9423 n fort washington rd #104 fresno, ca 93720": {
    mailing: "9423 N Fort Washington Rd #104, Fresno, CA 93720",
    coords: { venueLat: 36.8735055, venueLng: -119.776643 }
  },
  "7730 e belmont ave. fresno, ca 93737": {
    mailing: "7730 East Belmont Ave., Fresno, CA 93737",
    coords: { venueLat: 36.7513435, venueLng: -119.649554 }
  }
};

function resolveFromRules(key: string): KnownVenueRule | null {
  for (const venueRule of VENUE_RULES) {
    if (venueRule.match(key)) {
      return venueRule;
    }
  }
  return null;
}

function resolveMailingAndCoords(key: string): { mailing: string; coords: VenueCoords } | null {
  const exact = VENUE_BY_EXACT_NAME[key];
  if (exact) {
    return exact;
  }

  const matchedRule = resolveFromRules(key);
  if (matchedRule) {
    return { mailing: matchedRule.mailing, coords: matchedRule.coords };
  }

  return null;
}

export function resolveKnownVenueLocation(
  venueName: string
): Pick<NormalizedEvent, "venueAddress" | "venueCity" | "venueLat" | "venueLng"> {
  const key = normalizeVenueKey(venueName);
  if (!key) {
    return {};
  }

  const resolved = resolveMailingAndCoords(key);
  if (!resolved) {
    return {};
  }

  const { venueAddress, venueCity } = resolveVenueLocationFields(resolved.mailing, undefined, "CA");
  return {
    ...(venueAddress ? { venueAddress } : {}),
    ...(venueCity ? { venueCity } : {}),
    ...resolved.coords
  };
}

function hasStreet(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Fill missing street/city/coords from the Fresno venue catalog; never overwrites explicit ingest values. */
export function applyKnownVenueLocation(event: NormalizedEvent): NormalizedEvent {
  const known = resolveKnownVenueLocation(event.venueName);
  if (!known.venueAddress && known.venueLat === undefined) {
    return event;
  }

  const patch: Partial<NormalizedEvent> = {};
  if (!hasStreet(event.venueAddress) && known.venueAddress) {
    patch.venueAddress = known.venueAddress;
  }
  if (!hasStreet(event.venueCity) && known.venueCity) {
    patch.venueCity = known.venueCity;
  }
  if (!isValidCoordinate(event.venueLat) && known.venueLat !== undefined) {
    patch.venueLat = known.venueLat;
  }
  if (!isValidCoordinate(event.venueLng) && known.venueLng !== undefined) {
    patch.venueLng = known.venueLng;
  }

  if (Object.keys(patch).length === 0) {
    return event;
  }

  return { ...event, ...patch };
}
