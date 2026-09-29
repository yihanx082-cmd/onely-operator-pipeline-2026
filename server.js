const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { importLeads, messageFor } = require('./lib');

const dataFile = path.join(__dirname, 'data.json');
const sampleFile = path.join(__dirname, 'sample-leads.csv');
const statuses = new Set(['new', 'reviewed', 'contacted', 'replied', 'qualified', 'onboarded', 'rejected']);
let leads = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : [];
function save() { fs.writeFileSync(dataFile, JSON.stringify(leads, null, 2)); }
function send(res, code, value, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => { value += chunk; if (value.length > 2_000_000) { reject(new Error('Upload exceeds 2 MB')); req.destroy(); } });
    req.on('end', () => resolve(value));
    req.on('error', reject);
  });
}
function metrics() {
  const count = status => leads.filter(x => x.status === status).length;
  const reached = (field, later) => leads.filter(x => x[field] || later.includes(x.status)).length;
  return { total: leads.length, a: leads.filter(x => x.tier === 'A').length, contacted: reached('contacted_at', ['contacted', 'replied', 'qualified', 'onboarded']), replied: reached('replied_at', ['replied', 'qualified', 'onboarded']), qualified: reached('qualified_at', ['qualified', 'onboarded']), onboarded: count('onboarded') };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/leads') return send(res, 200, { leads, metrics: metrics() });
    if (req.method === 'GET' && url.pathname === '/api/sample') return send(res, 200, fs.readFileSync(sampleFile, 'utf8'), 'text/csv; charset=utf-8');
    if (req.method === 'POST' && url.pathname === '/api/import') {
      const result = importLeads(leads, await body(req)); save(); return send(res, 200, result);
    }
    const match = url.pathname.match(/^\/api\/leads\/([0-9a-f-]+)\/(status|message)$/);
    if (match) {
      const lead = leads.find(x => x.id === match[1]);
      if (!lead) return send(res, 404, { error: 'Lead not found' });
      if (req.method === 'GET' && match[2] === 'message') return send(res, 200, { message: messageFor(lead) });
      if (req.method === 'POST' && match[2] === 'status') {
        const { status } = JSON.parse(await body(req));
        if (!statuses.has(status)) return send(res, 400, { error: 'Invalid status' });
        lead.status = status; lead.updated_at = new Date().toISOString();
        if (['contacted', 'replied', 'qualified', 'onboarded'].includes(status)) lead.contacted_at ||= lead.updated_at;
        if (['replied', 'qualified', 'onboarded'].includes(status)) lead.replied_at ||= lead.updated_at;
        if (['qualified', 'onboarded'].includes(status)) lead.qualified_at ||= lead.updated_at;
        save();
        return send(res, 200, { lead, metrics: metrics() });
      }
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/styles.css') return send(res, 200, fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8'), 'text/css; charset=utf-8');
    return send(res, 404, { error: 'Not found' });
  } catch (error) { send(res, 400, { error: error.message }); }
});
if (require.main === module) server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Open http://127.0.0.1:${process.env.PORT || 3000}`));
module.exports = server;
