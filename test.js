const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, importLeads, scoreLead, messageFor } = require('./lib');

test('CSV quotes, deduplication and scoring work together', () => {
  const csv = 'name,contact,platforms,us_clients,portfolio_url,english,availability,source,notes\r\n"Ada, A",Ada@Example.com,"Instagram,TikTok",yes,https://example.com,yes,yes,Referral,"US creator"\r\nAda duplicate,ada@example.com,Instagram,yes,,yes,yes,Manual,duplicate\r\n';
  assert.equal(parseCSV(csv)[0].name, 'Ada, A');
  const leads = [];
  assert.deepEqual(importLeads(leads, csv), { added: 1, duplicate: 1, invalid: 0 });
  assert.equal(scoreLead(leads[0]).tier, 'A');
  assert.match(messageFor(leads[0]), /Referral/);
});
