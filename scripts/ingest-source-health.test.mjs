import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpectedSeasonalEmpty } from './ingest-source-health.utils.mjs';
test('only treats off-season Fair emptiness as expected, using Pacific month', () => {
 assert.equal(isExpectedSeasonalEmpty('big-fresno-fair',new Date('2026-11-08T12:00Z')),true);
 assert.equal(isExpectedSeasonalEmpty('big-fresno-fair',new Date('2026-11-01T06:30Z')),false);
 assert.equal(isExpectedSeasonalEmpty('tower-theatre',new Date('2026-11-08T12:00Z')),false);
});
