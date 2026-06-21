import { describe, expect, it } from "vitest";

import { decodeHtmlEntities, sanitizeIngestDescriptionText, stripBracketedLinkPlaceholders } from "./description-text.utils.js";

const WHITNEY_SAMPLE = `Doors 6PM / Show 7PM\r
&nbsp;\r
&nbsp;\r
Whitney Cummings first gained recognition as a stand-up comedian and has since become one of the most distinctive and influential comedic voices of the past two decades. She co-created and co-wrote the Emmy Award-winning CBS sitcom 2 Broke Girls, while simultaneously creating, producing, and starring in NBC&rsquo;s Whitney. She currently hosts the hit podcast Good for You [podcasts.apple.com] and starred in Friends: The Game Show on Max, a fan competition series celebrating the 30th anniversary of the iconic sitcom Friends.&nbsp;\r
&nbsp;\r
Known for her bold, observational humor, Cummings is currently touring North America with her Big Baby [whitneycummings.com] tour, delivering her signature sharp wit and fearless perspective on navigating the world as a single mom. Her latest material dives into the chaos of personal growth, the comedy of owning your mistakes, and laugh-out-loud reflections on raising a son. Her stand-up continues to blend personal anecdotes with incisive cultural commentary.\r
&nbsp;\r
Cummings has released six acclaimed stand-up specials across Netflix, Max, and Comedy Central. Beyond the stage, she&rsquo;s the author of the 2017 memoir I&rsquo;m Fine...And Other Lies [barnesandnoble.com], which offers an unflinchingly honest and humorous look at mental health and resilience. That same year, she made her directorial debut with The Female Brain, which she also co-wrote and starred in.\r
&nbsp;\r
Cummings remains a creative force behind some of entertainment&rsquo;s most original work. When she&rsquo;s not on the road, she lives in Los Angeles with her son, Henry, her pack of rescue dogs, and her horse.\r
&nbsp;\r
&nbsp;\r
VIP Ticket to include:&middot; &nbsp; &nbsp; &nbsp;&nbsp;\r
Meet &amp; Greet &amp; Photo with Whitney Cummings.Meet &amp; Greet ticket DOES NOT include a seat for the show.A separate show ticket MUST be purchased to attend Meet &amp; Greet.`;

describe("description-text.utils", () => {
  it("decodeHtmlEntities handles named entities", () => {
    expect(decodeHtmlEntities("NBC&rsquo;s Whitney &amp; Friends")).toBe("NBC's Whitney & Friends");
  });

  it("stripBracketedLinkPlaceholders removes domain brackets", () => {
    expect(stripBracketedLinkPlaceholders("Good for You [podcasts.apple.com] and more")).toBe(
      "Good for You and more"
    );
  });

  it("sanitizeIngestDescriptionText cleans Tower Theatre style copy", () => {
    const cleaned = sanitizeIngestDescriptionText(WHITNEY_SAMPLE);
    expect(cleaned).toContain("Doors 6PM / Show 7PM");
    expect(cleaned).toContain("NBC's Whitney");
    expect(cleaned).toContain("she's the author");
    expect(cleaned).toContain("Good for You and starred");
    expect(cleaned).not.toContain("&nbsp;");
    expect(cleaned).not.toContain("&rsquo;");
    expect(cleaned).not.toContain("[podcasts.apple.com]");
    expect(cleaned).not.toContain("[whitneycummings.com]");
    expect(cleaned).toContain("Meet & Greet & Photo with Whitney Cummings.");
    expect(cleaned).not.toMatch(/\n\n\n/);
  });
});
