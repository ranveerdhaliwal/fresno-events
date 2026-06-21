import { describe, expect, it } from "vitest";

import {
  canonicalOccurrenceTitle,
  computeDateOnlyOccurrenceKey,
  computeOccurrenceFingerprints,
  computeOccurrenceKey,
  computeUrlKey,
  normalizeListingUrl,
  normalizeTitle,
  normalizeVenue
} from "@fresno-events/shared";

describe("occurrence fingerprints", () => {
  it("normalizes titles and venues", () => {
    expect(normalizeTitle("Live: Jazz Night!!!")).toBe("jazz night");
    expect(normalizeVenue("Chukchansi Park")).toBe("save-mart-center");
    expect(normalizeVenue("Tower Theatre")).toBe("tower-theatre");
    expect(normalizeVenue("Strummer's")).toBe("strummers-club");
    expect(normalizeVenue("Strummers")).toBe("strummers-club");
    expect(normalizeVenue("Warnors Center")).toBe("warnors-theatre");
    expect(normalizeVenue("William Saroyan Theatre")).toBe("saroyan-theatre");
    expect(normalizeVenue("Save Mart Center at Fresno State - SMG")).toBe("save-mart-center");
    expect(normalizeVenue("Paul Paul Theatre")).toBe("big-fresno-fair");
    expect(normalizeVenue("Big Fresno Fair")).toBe("big-fresno-fair");
    expect(normalizeVenue("CMAC - Community Media Access Collaborative")).toBe("cmac");
    expect(normalizeVenue("1555 Van Ness Ave #201")).toBe("cmac");
  });

  it("matches Filmmaker Meetup across downtown Fresno and Venunite (CMAC vs street address)", async () => {
    const downtownFp = await computeOccurrenceFingerprints({
      title: "Filmmaker Meetup",
      startTs: "2026-08-01T01:00:00.000Z",
      venueName: "CMAC - Community Media Access Collaborative",
      ticketUrl: "https://FMJuly26.eventbrite.com/?aff=CC",
      externalUrl: undefined
    });
    const venuniteFp = await computeOccurrenceFingerprints({
      title: "Filmmaker Meetup",
      startTs: "2026-08-01T01:00:00.000Z",
      venueName: "1555 Van Ness Ave #201",
      ticketUrl: "https://www.eventbrite.com/e/filmmaker-meetup-tickets-1991636680926",
      externalUrl: undefined
    });

    expect(downtownFp.occurrenceKey).toBe(venuniteFp.occurrenceKey);
    expect(
      downtownFp.occurrenceKeysForLookup.some((key) => venuniteFp.occurrenceKeysForLookup.includes(key))
    ).toBe(true);
  });

  it("canonicalOccurrenceTitle aligns and vs & in co-headliner titles", () => {
    const downtown = normalizeTitle("Los Lobos and Los Lonely Boys - The Brotherhood Tour");
    const tm = normalizeTitle("Los Lobos & Los Lonely Boys: The Brotherhood Tour");
    expect(canonicalOccurrenceTitle(downtown)).toBe("los lobos los lonely boys the brotherhood tour");
    expect(canonicalOccurrenceTitle(tm)).toBe("los lobos los lonely boys the brotherhood tour");
  });

  it("matches Los Lobos downtown all-day listing vs Ticketmaster timed show", async () => {
    const downtownFp = await computeOccurrenceFingerprints({
      title: "Los Lobos and Los Lonely Boys - The Brotherhood Tour",
      startTs: "2026-08-02T12:00:00.000Z",
      venueName: "Warnors Center for the Performing Arts",
      ticketUrl: undefined,
      externalUrl: undefined
    });
    const tmFp = await computeOccurrenceFingerprints({
      title: "Los Lobos & Los Lonely Boys: The Brotherhood Tour",
      startTs: "2026-08-03T02:30:00.000Z",
      venueName: "Warnors Theatre",
      ticketUrl:
        "https://www.ticketmaster.com/los-lobos-los-lonely-boys-the-fresno-california-08-02-2026/event/1C006481F7F3F0B3",
      externalUrl: undefined
    });

    expect(downtownFp.dateOnlyOccurrenceKey).toBeTruthy();
    expect(tmFp.dateOnlyOccurrenceKey).toBe(downtownFp.dateOnlyOccurrenceKey);
    expect(
      downtownFp.occurrenceKeysForLookup.some((key) => tmFp.occurrenceKeysForLookup.includes(key))
    ).toBe(true);
  });

  it("keeps timed shows on different Pacific dates separate via date-only keys", async () => {
    const nightOne = await computeDateOnlyOccurrenceKey(
      "Shared Band Name",
      "2026-06-01T02:00:00.000Z",
      "Tower Theatre"
    );
    const nightTwo = await computeDateOnlyOccurrenceKey(
      "Shared Band Name",
      "2026-06-02T02:00:00.000Z",
      "Tower Theatre"
    );
    expect(nightOne).toBeTruthy();
    expect(nightOne).not.toBe(nightTwo);
  });

  it("canonicalOccurrenceTitle aligns Gabriel Iglesias fair vs Ticketmaster", () => {
    const fair = normalizeTitle('Gabriel "Fluffy" Iglesias LIVE');
    const tm = normalizeTitle("Gabriel Iglesias");
    expect(canonicalOccurrenceTitle(fair)).toBe("gabriel iglesias");
    expect(canonicalOccurrenceTitle(tm)).toBe("gabriel iglesias");
  });

  it("matches Gabriel Iglesias across fair API and Ticketmaster", async () => {
    const ts = "2026-10-09T02:00:00.000Z";
    const fair = await computeOccurrenceKey(
      'Gabriel "Fluffy" Iglesias LIVE',
      ts,
      "Big Fresno Fair"
    );
    const tm = await computeOccurrenceKey("Gabriel Iglesias", ts, "Paul Paul Theatre");
    expect(fair).toBe(tm);
  });

  it("canonicalOccurrenceTitle aligns promo-night Grizzlies titles", () => {
    const promo = normalizeTitle("Kids Make the Rules Night: Fresno Grizzlies vs Lake Elsinore Storm");
    const plain = normalizeTitle("Fresno Grizzlies vs. Lake Elsinore Storm");
    expect(canonicalOccurrenceTitle(promo)).toBe("fresno grizzlies vs lake elsinore storm");
    expect(canonicalOccurrenceTitle(plain)).toBe("fresno grizzlies vs lake elsinore storm");
  });

  it("canonicalOccurrenceTitle aligns Miss California pageant titles", () => {
    const tm = normalizeTitle("Miss California 2026");
    const visit = normalizeTitle("Miss California Competition Week");
    const downtown = normalizeTitle("Miss California Competition 2026");
    expect(canonicalOccurrenceTitle(tm)).toBe("miss california");
    expect(canonicalOccurrenceTitle(visit)).toBe("miss california");
    expect(canonicalOccurrenceTitle(downtown)).toBe("miss california");

    const teenScrape = normalizeTitle("Miss California Teen 2026");
    const teenTm = normalizeTitle("Miss California's Teen 2026");
    expect(canonicalOccurrenceTitle(teenScrape)).toBe("miss california teen");
    expect(canonicalOccurrenceTitle(teenTm)).toBe("miss california teen");
  });

  it("matches Miss California across Visit, FCC scrape, and Ticketmaster", async () => {
    const ts = "2026-06-17T02:00:00.000Z";
    const visit = await computeOccurrenceKey(
      "Miss California Competition Week",
      ts,
      "William Saroyan Theatre"
    );
    const scrape = await computeOccurrenceKey("Miss California 2026", ts, "Saroyan Theatre");
    const tm = await computeOccurrenceKey(
      "Miss California 2026",
      ts,
      "William Saroyan Theatre Fresno Convention & Entertainment Center"
    );
    expect(visit).toBe(scrape);
    expect(scrape).toBe(tm);
  });

  it("keeps Miss California teen separate from main pageant", async () => {
    const teen = await computeOccurrenceKey(
      "Miss California's Teen 2026",
      "2026-06-19T02:00:00.000Z",
      "William Saroyan Theatre"
    );
    const main = await computeOccurrenceKey(
      "Miss California 2026",
      "2026-06-19T02:00:00.000Z",
      "William Saroyan Theatre"
    );
    expect(teen).not.toBe(main);
  });

  it("canonicalOccurrenceTitle strips concert suffix noise", () => {
    const a = normalizeTitle("The Psychedelic Furs & We Are Scientists Live In Concert");
    const b = normalizeTitle("The Psychedelic Furs & We Are Scientists - Fresno");
    expect(canonicalOccurrenceTitle(a)).toBe("the psychedelic furs we are scientists");
    expect(canonicalOccurrenceTitle(b)).toBe("the psychedelic furs we are scientists");
  });

  it("matches Strummers scrape vs Ticketmaster on same show", async () => {
    const scrape = await computeOccurrenceKey("MACHINE HEAD", "2026-06-27T03:30:00.000Z", "Strummers");
    const tm = await computeOccurrenceKey("Machine Head", "2026-06-27T03:30:00.000Z", "Strummer's");
    expect(scrape).toBeTruthy();
    expect(scrape).toBe(tm);
  });

  it("matches Visit promo Grizzlies vs Ticketmaster vs MiLB", async () => {
    const visit = await computeOccurrenceKey(
      "Kids Make the Rules Night: Fresno Grizzlies vs Lake Elsinore Storm",
      "2026-06-07T01:50:00Z",
      "Chukchansi Park"
    );
    const tm = await computeOccurrenceKey(
      "Fresno Grizzlies vs. Lake Elsinore Storm",
      "2026-06-07T01:50:00Z",
      "Chukchansi Park"
    );
    const milb = await computeOccurrenceKey(
      "Fresno Grizzlies vs Lake Elsinore Storm",
      "2026-06-07T01:50:00Z",
      "Chukchansi Park"
    );
    expect(visit).toBe(tm);
    expect(tm).toBe(milb);
  });

  it("unwraps ticketmaster affiliate links to the nested event URL", async () => {
    const affiliate =
      "https://ticketmaster.evyy.net/c/4241810/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fmonster-jam-fresno-california-08-23-2026%2Fevent%2F1C006488A5C5C787&utm_medium=affiliate";
    expect(normalizeListingUrl(affiliate)).toBe("ticketmaster.com/event/1c006488a5c5c787");

    const a = await computeUrlKey({ ticketUrl: affiliate, externalUrl: undefined });
    const b = await computeUrlKey({
      ticketUrl: "https://www.ticketmaster.com/monster-jam-fresno-california-08-23-2026/event/1C006488A5C5C787",
      externalUrl: undefined
    });
    expect(a).toBe(b);
  });

  it("does not collapse unrelated save mart affiliate links", async () => {
    const monsterJam =
      "https://ticketmaster.evyy.net/c/4241810/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fmonster-jam-fresno-california-08-23-2026%2Fevent%2F1C006488A5C5C787";
    const geneSimmons =
      "https://ticketmaster.evyy.net/c/4241810/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fgene-simmons-and-his-band-sebastian-fresno-california-07-17-2026%2Fevent%2F1C006474C816EF61";
    const a = await computeUrlKey({ ticketUrl: monsterJam, externalUrl: undefined });
    const b = await computeUrlKey({ ticketUrl: geneSimmons, externalUrl: undefined });
    expect(a).not.toBe(b);
  });

  it("matches shared ticketmaster URLs via url_key", async () => {
    const a = await computeUrlKey({
      ticketUrl: "https://www.ticketmaster.com/event/G5vYZ_6CVeHMu?v=1",
      externalUrl: undefined
    });
    const b = await computeUrlKey({
      ticketUrl: "https://ticketmaster.com/event/G5vYZ_6CVeHMu?aff=abc",
      externalUrl: undefined
    });
    expect(a).toBe(b);
    expect(normalizeListingUrl("https://www.ticketmaster.com/event/G5vYZ_6CVeHMu/"))?.toBe(
      "ticketmaster.com/event/g5vyz_6cvehmu"
    );
  });

  it("matches shared eventbrite URLs via url_key", async () => {
    const a = await computeUrlKey({
      ticketUrl: "https://www.eventbrite.com/e/sample-show-tickets-123456789",
      externalUrl: undefined
    });
    const b = await computeUrlKey({
      externalUrl: "https://eventbrite.com/e/other-slug-123456789?aff=xyz",
      ticketUrl: undefined
    });
    expect(a).toBe(b);
  });

  it("produces stable occurrence keys for the same show", async () => {
    const a = await computeOccurrenceKey("Jazz Night", "2026-06-01T02:00:00.000Z", "Tower Theatre");
    const b = await computeOccurrenceKey("Jazz Night", "2026-06-01T02:00:00.000Z", "Tower Theatre");
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it("matches shared ticket URLs via url_key", async () => {
    const url = "https://www.eventbrite.com/e/sample-show-123?aff=abc";
    const a = await computeUrlKey({ ticketUrl: url, externalUrl: undefined });
    const b = await computeUrlKey({
      ticketUrl: "https://www.eventbrite.com/e/sample-show-123?aff=xyz",
      externalUrl: undefined
    });
    expect(a).toBe(b);
  });

  it("returns adjacent bucket lookup keys", async () => {
    const fp = await computeOccurrenceFingerprints({
      title: "Concert",
      startTs: "2026-06-01T02:00:00.000Z",
      venueName: "Rainbow Ballroom",
      ticketUrl: undefined,
      externalUrl: undefined
    });
    expect(fp.occurrenceKeysForLookup.length).toBeGreaterThanOrEqual(1);
  });
});
