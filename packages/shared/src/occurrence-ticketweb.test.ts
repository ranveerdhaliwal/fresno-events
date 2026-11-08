import {expect,it} from 'vitest';
import {computeUrlKey,isUniquePerPerformanceListingUrl,normalizeListingUrl} from './occurrence';
it('shares one performance identity across TicketWeb lineup-slug and promoter changes',async()=>{
 const a='https://www.ticketweb.com/event/havok-hellripper-slackjaw-xoth-strummers-tickets/15036703?pl=numbskullshows';
 const b='https://www.ticketweb.com/event/havok-slackjaw-xoth-thrallr-strummers-tickets/15036703';
 expect(normalizeListingUrl(a)).toBe('ticketweb.com/event/15036703');
 expect(await computeUrlKey({ticketUrl:a})).toBe(await computeUrlKey({ticketUrl:b}));
 expect(isUniquePerPerformanceListingUrl(normalizeListingUrl(a))).toBe(true);
 expect(await computeUrlKey({ticketUrl:b})).not.toBe(await computeUrlKey({ticketUrl:b.replace('15036703','15036704')}));
});
it('keeps venue series landing pages and unrelated hosts outside performance-wide matching',()=>{
 expect(isUniquePerPerformanceListingUrl(normalizeListingUrl('https://ticketweb.com/venue/strummers/42'))).toBe(false);
 expect(isUniquePerPerformanceListingUrl(normalizeListingUrl('https://fake-ticketweb.com/event/show/15036703'))).toBe(false);
});
