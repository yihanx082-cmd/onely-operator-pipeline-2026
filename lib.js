const { randomUUID } = require('node:crypto');

function parseCSV(input) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('CSV has an unclosed quote');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim().toLowerCase());
  if (!headers.includes('name') || !headers.includes('contact')) throw new Error('CSV needs name and contact columns');
  return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, (values[i] || '').trim()])));
}

function normalizeContact(value) {
  return String(value || '').trim().toLowerCase().replace(/\/$/, '');
}

function scoreLead(lead) {
  const evidence = String(lead.notes || '').toLowerCase();
  const platforms = String(lead.platforms || '').toLowerCase();
  const us = /^(yes|true|1)$/i.test(String(lead.us_clients || '').trim());
  const english = /^(yes|true|1)$/i.test(String(lead.english || '').trim());
  const hasPlatform = /instagram|tiktok|youtube|facebook|reddit|x\/twitter/.test(platforms);
  const portfolio = /^https?:\/\//i.test(String(lead.portfolio_url || ''));
  const available = /^(yes|true|1)$/i.test(String(lead.availability || '').trim());
  let score = (us ? 35 : 0) + (hasPlatform ? 20 : 0) + (portfolio ? 20 : 0) + (english ? 15 : 0) + (available ? 10 : 0);
  if (/creator|community|fan|subscription/.test(evidence)) score = Math.min(100, score + 5);
  return { score, tier: score >= 80 ? 'A' : score >= 55 ? 'B' : 'C' };
}

function messageFor(lead) {
  const first = String(lead.name || 'there').trim().split(/\s+/)[0];
  const platform = String(lead.platforms || '').split(/[,;|]/)[0].trim() || 'social media';
  const us = /^(yes|true|1)$/i.test(String(lead.us_clients || '').trim());
  const context = us ? 'your experience supporting US-facing creators' : `your ${platform} operations experience`;
  return `Hi ${first}, I found your profile through ${lead.source || 'a professional community'} and noticed ${context}. Onely is inviting a small group of operators to test workflows for creator content, audience growth, and fan relationships. Would you be open to a 15-minute fit call this week? I can share the scope, compensation model, and a short skills brief first. No account access or unpaid production work is required. If this is not relevant, just say no and I will not follow up.`;
}

function importLeads(existing, csv) {
  const rows = parseCSV(csv);
  const seen = new Set(existing.map(x => normalizeContact(x.contact)));
  let added = 0, duplicate = 0, invalid = 0;
  for (const row of rows) {
    const key = normalizeContact(row.contact);
    if (!row.name || !key) { invalid++; continue; }
    if (seen.has(key)) { duplicate++; continue; }
    seen.add(key);
    existing.push({ ...row, id: randomUUID(), status: 'new', ...scoreLead(row), created_at: new Date().toISOString() });
    added++;
  }
  return { added, duplicate, invalid };
}

module.exports = { parseCSV, normalizeContact, scoreLead, messageFor, importLeads };
