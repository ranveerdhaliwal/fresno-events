import { describe, expect, it } from "vitest";

import { parsePlainHtmlDetailPage } from "./html-detail.utils";

const TOWER_RAID_HTML = `
<html><head>
  <meta property="og:title" content="THE RAID: REDEMPTION Film Screening | Tower Theatre Ticketing" />
</head><body>
  <div class="location">
    <div><i class="fa fa-solid fa-location-dot"></i></div>
    <div class="datetime-location-content">Tower Theatre for the Performing Arts</div>
  </div>
  <div class="location">
    <div><i class="fa fa-solid fa-map"></i></div>
    <div class="datetime-location-content">815 East Olive Avenue, Fresno, CA 93728</div>
  </div>
  <h1>THE RAID: REDEMPTION Film Screening</h1>
  <p><img class="img-responsive" src="https://res.cloudinary.com/eventservice/image/upload/q_auto,f_auto/v1778504104/saas/rte_uploads/TRtower4x5152461242540181.webp" alt="" /></p>
  <div class="photo" style="background-image:url('https://res.cloudinary.com/eventservice/image/upload/q_auto,f_auto/v1778597381/saas/gallery/rnfjsgdmpsvf9bwq6mfm.webp');">
    <a href="https://res.cloudinary.com/eventservice/image/upload/q_auto,f_auto/v1778597381/saas/gallery/rnfjsgdmpsvf9bwq6mfm.webp" data-fancybox="gallery"></a>
  </div>
  <script type="application/ld+json">
  {"@context":"http://schema.org","@type":"MusicEvent","name":"THE RAID: REDEMPTION Film Screening","url":"https://towertheatre.ticketsauce.com/e/the-raid-redemption/tickets","location":{"@type":"Place","name":"Tower Theatre for the Performing Arts","address":{"@type":"PostalAddress","streetAddress":"815 East Olive Avenue","addressLocality":"Fresno","addressRegion":"CA","postalCode":"93728","addressCountry":"United States"}},"startDate":"2026-06-05T19:00:00-07:00","description":"7PM DOORS // 8PM SHOWTIME","offers":[{"@type":"Offer","name":"General Admission","price":"10.00","priceCurrency":"USD","url":"https://towertheatre.ticketsauce.com/e/the-raid-redemption/tickets","availability":"https://schema.org/InStock"}]}
  </script>
</body></html>
`;

describe("parsePlainHtmlDetailPage", () => {
  it("extracts Tower Theatre TicketSauce image, address, venue, and ticket URL from JSON-LD + HTML", () => {
    const detail = parsePlainHtmlDetailPage(
      TOWER_RAID_HTML,
      "https://towertheatre.ticketsauce.com/e/the-raid-redemption",
      "Tower Theatre"
    );

    expect(detail?.title).toBe("THE RAID: REDEMPTION Film Screening");
    expect(detail?.venueName).toBe("Tower Theatre for the Performing Arts");
    expect(detail?.venueAddress).toBe("815 East Olive Avenue");
    expect(detail?.venueCity).toBe("Fresno");
    expect(detail?.imageUrl).toContain("TRtower4x5152461242540181.webp");
    expect(detail?.ticketUrl).toContain("/the-raid-redemption/tickets");
    expect(detail?.priceMin).toBe(10);
    expect(detail?.startTs).toBe("2026-06-05T19:00:00-07:00");
  });

  it("falls back to gallery image when inline poster is missing", () => {
    const html = TOWER_RAID_HTML.replace(/<img class="img-responsive"[^>]*>/, "");
    const detail = parsePlainHtmlDetailPage(
      html,
      "https://towertheatre.ticketsauce.com/e/the-raid-redemption",
      "Tower Theatre"
    );
    expect(detail?.imageUrl).toContain("rnfjsgdmpsvf9bwq6mfm.webp");
  });

  it("excludes parking offers from TicketSauce price min/max", () => {
    const html = `
      <h1>BILLY JOEL Tribute - Billy Nation</h1>
      <script type="application/ld+json">
      {"@context":"http://schema.org","@type":"MusicEvent","name":"BILLY JOEL Tribute - Billy Nation","startDate":"2026-07-18T19:00:00-07:00","offers":[
        {"@type":"Offer","name":"BACK","price":"31.00","priceCurrency":"USD"},
        {"@type":"Offer","name":"MIDDLE","price":"36.00","priceCurrency":"USD"},
        {"@type":"Offer","name":"FRONT","price":"42.00","priceCurrency":"USD"},
        {"@type":"Offer","name":"RESERVE PARKING","price":"25.00","priceCurrency":"USD"}
      ]}
      </script>
    `;
    const detail = parsePlainHtmlDetailPage(
      html,
      "https://towertheatre.ticketsauce.com/e/billy-joel",
      "Tower Theatre"
    );
    expect(detail?.priceMin).toBe(31);
    expect(detail?.priceMax).toBe(42);
  });

  it("reads og:image when JSON-LD has no image field", () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/poster.jpg" />
      <h1>Local Show</h1>
      <time datetime="2026-07-01T19:00:00-07:00"></time>
    `;
    const detail = parsePlainHtmlDetailPage(html, "https://example.com/e/local-show", "Example Venue");
    expect(detail?.imageUrl).toBe("https://cdn.example.com/poster.jpg");
  });
});
