import { describe, expect, it } from "vitest";

import {
  cleanFresnoFairDescriptionText,
  mergeFresnoFairDetail,
  parseDollarAmounts,
  parseFresnoFairDescription,
  parseFresnoFairDetailPage,
  parseTicketsStartAtPrice,
  pickFresnoFairDescription
} from "./fresno-fair-detail.utils";

const KANSAS_DETAIL_HTML = `
<html><body>
<h2>DATE: <span>WED, october 7</span><br>TIME: <span>7 P.M.</span><br><br>In-Person Box Office Prices:<br><span style="color: rgb(0, 0, 0);">$45 / $50 / $57 / $65</span><br></h2>
<h2>Online Prices (all fees included):<br><span style="color: rgb(0, 0, 0);">$51 / $56 / $63.50 / $71.50</span></h2>
<a href="https://www.etix.com/ticket/p/81610003/kansas-starship-featmickey-thomas-fresno-the-big-fresno-fair-box-office" target="_blank"><span class="button">BUY TICKETS</span></a>
</body></html>
`;

const MATT_MAHER_DETAIL_HTML = `
<html><body>
<h2>In-Person Box Office Prices:<br><span style="color: rgb(0, 0, 0);">$15 / $20 / $35</span><br></h2>
<h2>Online Prices (all fees included):<br><span style="color: rgb(0, 0, 0);">$17 / $23 / $40</span><br><br></h2>
<a href="https://www.etix.com/ticket/p/48113238/matt-maher-with-caleb-john-fresno-the-big-fresno-fair-box-office" target="_blank"><span class="button">BUY TICKETS</span></a>
</body></html>
`;

const FORTY_ABOVE_DETAIL_HTML = `
<html><body>
<div class="entityContainerModule module_1055 TextMediaModule">
  <div class="modulePageTextMedia">of<script>lozad()</script> Transcript</div>
</div>
<div class="entityContainerModule module_1055 TextMediaModule">
  <div class="modulePageTextMedia">
    <h2>15th ANNUAL 4.0 &amp; ABOVE PROGRAM</h2>
    of
    Transcript
  </div>
</div>
<div class="entityContainerModule module_1056 TextMediaModule">
  <div class="modulePageTextMedia">
    <h2>SAVE THE DATE</h2>
    <h2>2026 4.0 &amp; ABOVE PROGRAM RALLY</h2>
    <h2>WEDNESDAY, OCTOBER 7 AT 6:30 P.M.</h2>
    <h2>REWARDING HARD-WORKING FRESNO COUNTY STUDENTS</h2>
    <p>All of those long hours spent hitting the books will pay off for Fresno County students at the 2026 Big Fresno Fair as part of the 4.0 &amp; Above Program! This program invites all 8th – 12th grade students in Fresno County, whose GPA is 4.0 or above as of June 2026, to The Big Fresno Fair for FREE on Wednesday, October 7 for this rally-like event honoring them.</p>
    <p>Qualified 4.0 &amp; Above students will have the chance to win scholarships, laptops and more! Qualified 9th – 12th grade students even have the chance to win a brand new Toyota Corolla! Students must be present to win!</p>
    <p><strong>Step 1:</strong> Make sure you are a Fresno County 8th – 12th grade student.</p>
    <p><strong>Step 2:</strong> Make sure you have a GPA of 4.0 or higher as of June 2026</p>
    <p><strong>Step 3:</strong> Mark Your Calendars for October 7, 2026 at 6:30 p.m.</p>
    <p>For more information on The Big Fresno Fair's annual 4.0 &amp; Above Program, please email 4gpa@fresnofair.com or call (559) 650-3229.</p>
  </div>
</div>
<div class="entityContainerModule module_1785 TextMediaModule">
  <div class="modulePageTextMedia">
    <h2>4.0 &amp; ABOVE PROGRAM HIGHLIGHTS!</h2>
    <p>In the past 14 years, we have given away a total of $983,500 in scholarships, 13 new cars and other prizes like laptops and iPads.</p>
    of Transcript
  </div>
</div>
<div class="entityContainerModule module_24862 TextMediaModule">
  <div class="modulePageTextMedia">
    <h2>2025 4.0 &amp; ABove winners</h2>
    <p>Congratulations to all of the 2025 4.0 &amp; Above qualified students and the winners.</p>
    <p><strong>High School Winners</strong></p>
    <p><strong>Toyota Corolla</strong> | Mia Salcedo, Sunnyside High School</p>
  </div>
</div>
<div class="entityContainerModule module_33704 TextMediaModule">
  <div class="modulePageTextMedia">
    <span id="selection-marker-1" class="redactor-selection-marker"></span>
    of Transcript
  </div>
</div>
</body></html>
`;

describe("parseDollarAmounts", () => {
  it("parses slash-separated dollar tiers", () => {
    expect(parseDollarAmounts("$45 / $50 / $57 / $65")).toEqual([45, 50, 57, 65]);
    expect(parseDollarAmounts("$51 / $56 / $63.50 / $71.50")).toEqual([51, 56, 63.5, 71.5]);
  });
});

describe("parseTicketsStartAtPrice", () => {
  it("extracts starting ticket price from listing copy", () => {
    expect(
      parseTicketsStartAtPrice(
        "Opening up the 2026 Table Mountain Concert Series on Wed, Oct 7 is Kansas with Starship ft. Mickey Thomas! Tickets start at $45."
      )
    ).toEqual({ priceMin: 45, currency: "USD" });
  });
});

describe("parseFresnoFairDetailPage", () => {
  it("extracts box office min/max, online tiers in notes, and eTix ticket URL", () => {
    const parsed = parseFresnoFairDetailPage(KANSAS_DETAIL_HTML);
    expect(parsed).toEqual({
      priceMin: 45,
      priceMax: 65,
      currency: "USD",
      priceNotes: "In-Person: $45/$50/$57/$65 · Online: $51/$56/$63.50/$71.50",
      ticketUrl:
        "https://www.etix.com/ticket/p/81610003/kansas-starship-featmickey-thomas-fresno-the-big-fresno-fair-box-office"
    });
  });

  it("handles smaller tier lists", () => {
    const parsed = parseFresnoFairDetailPage(MATT_MAHER_DETAIL_HTML);
    expect(parsed?.priceMin).toBe(15);
    expect(parsed?.priceMax).toBe(35);
    expect(parsed?.priceNotes).toBe("In-Person: $15/$20/$35 · Online: $17/$23/$40");
    expect(parsed?.ticketUrl).toContain("etix.com");
  });

  it("returns null when no pricing or ticket link is present", () => {
    expect(parseFresnoFairDetailPage("<html><body><h1>Seniors Day</h1></body></html>")).toBeNull();
  });

  it("returns description-only detail for non-ticketed program pages", () => {
    const parsed = parseFresnoFairDetailPage(FORTY_ABOVE_DETAIL_HTML);
    expect(parsed?.priceMin).toBeUndefined();
    expect(parsed?.descriptionText).toContain("REWARDING HARD-WORKING FRESNO COUNTY STUDENTS");
    expect(parsed?.descriptionText).toContain("4gpa@fresnofair.com");
    expect(parsed?.descriptionText).not.toMatch(/High School Winners/i);
    expect(parsed?.descriptionText).not.toMatch(/transcript/i);
  });
});

describe("cleanFresnoFairDescriptionText", () => {
  it("removes transcript stubs, html tags, and empty lines", () => {
    expect(
      cleanFresnoFairDescriptionText(`
        15th ANNUAL 4.0 & ABOVE PROGRAM
        of
        Transcript
        <span id="selection-marker-1" class="redactor-selection-marker"></span>
        SAVE THE DATE
      `)
    ).toBe("15th ANNUAL 4.0 & ABOVE PROGRAM\n\nSAVE THE DATE");
  });
});

describe("parseFresnoFairDescription", () => {
  it("uses one primary paragraph block and skips extra sections", () => {
    const description = parseFresnoFairDescription(FORTY_ABOVE_DETAIL_HTML);
    expect(description).toContain("REWARDING HARD-WORKING FRESNO COUNTY STUDENTS");
    expect(description).toContain("Step 1");
    expect(description).toContain("4gpa@fresnofair.com");
    expect(description).not.toMatch(/transcript/i);
    expect(description).not.toMatch(/High School Winners/i);
    expect(description).not.toMatch(/PROGRAM HIGHLIGHTS/i);
    expect(description).not.toContain("selection-marker");
  });
});

describe("pickFresnoFairDescription", () => {
  it("prefers detail copy when it is substantially richer than listing API text", () => {
    const listing = "The 4.0 & Above Program provides a fun, rally-like atmosphere.";
    const detail = [
      listing,
      "REWARDING HARD-WORKING FRESNO COUNTY STUDENTS",
      "All Fresno County 8th – 12th grade students with a 4.0 GPA or higher are invited to the Fair for FREE.",
      "Qualified students can win scholarships, laptops, and more.",
      "For more information, email 4gpa@fresnofair.com or call (559) 650-3229."
    ].join("\n\n");
    expect(pickFresnoFairDescription(listing, detail)).toBe(detail);
  });

  it("keeps listing copy for short concert blurbs when detail is mostly pricing", () => {
    const listing =
      "Opening up the 2026 Table Mountain Concert Series on Wed, Oct 7 is Kansas with Starship ft. Mickey Thomas!";
    const detail = "DATE: WED, october 7. In-Person Box Office Prices: $45 / $50 / $57 / $65";
    expect(pickFresnoFairDescription(listing, detail)).toBe(listing);
  });
});

describe("mergeFresnoFairDetail", () => {
  it("merges detail pricing onto listing event without overwriting title", () => {
    const listing = {
      source: "scrape:www.fresnofair.com" as const,
      sourceEventId: "venue:big-fresno-fair:3714:2026-10-07",
      title: "Kansas With Starship feat. Mickey Thomas",
      venueName: "Big Fresno Fair",
      startTs: "2026-10-08T02:00:00.000Z",
      externalUrl: "https://www.fresnofair.com/events/2026/kansas-starship-mickey"
    };

    const merged = mergeFresnoFairDetail(listing, parseFresnoFairDetailPage(KANSAS_DETAIL_HTML));
    expect(merged.title).toBe("Kansas With Starship feat. Mickey Thomas");
    expect(merged.priceMin).toBe(45);
    expect(merged.priceMax).toBe(65);
    expect(merged.ticketUrl).toContain("etix.com");
  });

  it("merges rich program description for non-ticketed fair events", () => {
    const listing = {
      source: "scrape:www.fresnofair.com" as const,
      sourceEventId: "venue:big-fresno-fair:58:2026-10-07",
      title: "4.0 & Above",
      venueName: "Big Fresno Fair",
      startTs: "2026-10-08T01:30:00.000Z",
      externalUrl: "https://www.fresnofair.com/events/2026/40--above",
      descriptionText:
        "The 4.0 & Above Program provides a fun, rally-like atmosphere to recognize and celebrate students for their hard work and scholastic achievements."
    };

    const merged = mergeFresnoFairDetail(listing, parseFresnoFairDetailPage(FORTY_ABOVE_DETAIL_HTML));
    expect(merged.descriptionText).toContain("REWARDING HARD-WORKING FRESNO COUNTY STUDENTS");
    expect(merged.descriptionText).toContain("4gpa@fresnofair.com");
    expect(merged.descriptionText!.length).toBeGreaterThan(300);
  });
});
