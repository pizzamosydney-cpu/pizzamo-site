// Build: data/*.json + src/index.template.html  ->  dist/  (no dependencies, Node 18+)
// If any data is invalid the build FAILS with a clear message, and Netlify keeps the previous live version.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const errors = [];
const fail = (msg) => errors.push(msg);

// ---------- menu ----------
const menu = read('data/menu.json');
const fmtPrice = (p, addOn) => `${addOn ? '+' : ''}$${Number.isInteger(p) ? p : p.toFixed(2)}`;

function renderItem(it, where) {
  if (!it.name || !String(it.name).trim()) return fail(`${where}: an item has no name`);
  if (typeof it.price !== 'number' || !(it.price > 0)) return fail(`${where} › ${it.name}: price must be a number above 0 (got "${it.price}")`);
  if (it.available === false) return '';                       // hidden, e.g. sold out
  const tags = [];
  if (it.vegan) tags.push('<abbr class="menu__tag" title="Vegan">VG</abbr>');
  else if (it.vegetarian) tags.push('<abbr class="menu__tag" title="Vegetarian">V</abbr>');
  const desc = (it.description || '').trim();
  const p = desc || tags.length ? `\n            <p class="menu__desc">${esc(desc)}${desc && tags.length ? ' ' : ''}${tags.join('')}</p>` : '';
  return `          <li class="menu__item">
            <div class="menu__row"><span class="menu__name">${esc(it.name)}</span><span class="menu__dots"></span><span class="menu__price">${fmtPrice(it.price, it.add_on)}</span></div>${p}
          </li>`;
}

function renderCategory(c, gap) {
  if (!c.name) { fail('a category has no name'); return ''; }
  const items = (c.items || []).map((it) => renderItem(it, c.name)).filter((x) => x !== undefined);
  if (!items.some(Boolean)) return '';                         // empty category: hide it
  const note = c.note ? ` <span class="menu__cat-note">${esc(c.note)}</span>` : '';
  return `        <h3 class="menu__cat-title${gap ? ' menu__cat-title--gap' : ''}">${esc(c.name)}${note}</h3>
        <ul class="menu__list">
${items.join('\n')}
        </ul>`;
}

const cats = menu.categories || [];
if (!cats.length) fail('menu has no categories');
const left = cats.slice(0, 1).map((c) => renderCategory(c, false)).filter(Boolean);
const right = cats.slice(1).map((c, i) => renderCategory(c, i > 0)).filter(Boolean);
const menuHtml = `    <div class="menu">

      <div class="menu__cat">
${left.join('\n')}
      </div>

      <div class="menu__cat">
${right.join('\n')}
      </div>

    </div>
`;

// ---------- hours ----------
const hours = read('data/hours.json');
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
const hoursHtml = days.map((d) => {
  const h = (hours.days || []).find((x) => x.day === d);
  if (!h) { fail(`hours: ${d} is missing`); return ''; }
  if (h.closed) return `          <tr><th scope="row">${d}</th><td>Closed</td></tr>`;
  if (!hhmm.test(h.open || '') || !hhmm.test(h.close || '')) { fail(`hours: ${d} needs times like 17:00 and 22:30 (got "${h.open}" and "${h.close}")`); return ''; }
  return `          <tr><th scope="row">${d}</th><td>${h.open}–${h.close}</td></tr>`;
}).join('\n');

// ---------- notice banner ----------
const site = read('data/site.json');
const notice = (site.notice || '').trim();
const noticeHtml = notice ? `<div class="notice notice--${site.notice_style === 'alert' ? 'alert' : 'info'}" role="status">${esc(notice)}</div>` : '';

// ---------- FAQ (data/faq.json) ----------
const isHttps = (u) => /^https:\/\/[^\s"'<>]+$/.test(u || '');
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
const rich = (t) => esc(t).replace(/\n/g, '<br>')                     // escaped text, plus [text](https://link) links
  .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/Basilico/g, '<span class="bas">Basilico</span>');         // house style: the word Basilico is always yellow
const faqAll = (fs.existsSync(path.join(root, 'data/faq.json')) ? read('data/faq.json') : { items: [] }).items || [];
const faqHtml = faqAll.filter((x) => x.active !== false).map((x, i) => {
  if (!x.question || !x.answer) { fail(`FAQ #${i + 1}: an active question needs both a question and an answer (untick "Show" to hide it)`); return ''; }
  return `    <details>\n      <summary>${esc(x.question)}</summary>\n      <p>${rich(x.answer)}</p>\n    </details>`;
}).join('\n');

// ---------- contact details (data/contact.json) ----------
const contact = fs.existsSync(path.join(root, 'data/contact.json')) ? read('data/contact.json') : {};
const phone = (contact.phone || '').trim();
const phoneLink = (contact.phone_link || contact.phone || '').trim();
if (phone && !/^\+?[0-9 ()-]{6,20}$/.test(phone)) fail(`contact: phone looks wrong ("${phone}")`);
if (phoneLink && !/^\+?[0-9 ()-]{6,20}$/.test(phoneLink)) fail(`contact: phone for tap-to-call looks wrong ("${phoneLink}")`);
if (contact.email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(contact.email)) fail(`contact: email looks wrong ("${contact.email}")`);
for (const k of ['instagram', 'facebook']) if (contact[k] && !isHttps(contact[k])) fail(`contact: ${k} must be a full link starting with https://`);
const phoneBr = phone ? `<br><a href="tel:${esc(phoneLink.replace(/[^+0-9]/g, ''))}">${esc(phone)}</a>` : '';
const contactHtml = [
  contact.email && `<li><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></li>`,
  contact.instagram && `<li><a href="${esc(contact.instagram)}" target="_blank" rel="noopener">Instagram</a></li>`,
  contact.facebook && `<li><a href="${esc(contact.facebook)}" target="_blank" rel="noopener">Facebook</a></li>`,
].filter(Boolean).join('\n      ');
const jsonStr = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// ---------- closed dates (data/site.json -> closures), shown automatically by js/site.js ----------
const closures = (site.closures || []).filter((c) => c && c.from && c.message);
closures.forEach((c, i) => {
  if (!isDate(c.from)) fail(`closed dates #${i + 1}: "From" must look like 2026-12-24`);
  if (c.to && !isDate(c.to)) fail(`closed dates #${i + 1}: "To" must look like 2026-12-24`);
  if (c.to && c.to < c.from) fail(`closed dates #${i + 1}: "To" is before "From"`);
});
const config = { timezone: site.timezone || 'Australia/Sydney', closures: closures.map((c) => ({ from: c.from, to: c.to || c.from, message: c.message, style: c.style === 'info' ? 'info' : 'alert' })) };
const configHtml = `<script>window.SITE_CONFIG = ${JSON.stringify(config).replace(/</g, '\\u003c')};</script>`;

if (errors.length) {
  console.error('\nBUILD STOPPED. Fix these in the CMS and save again (the live site is unchanged):\n');
  errors.forEach((e) => console.error('  • ' + e));
  process.exit(1);
}

// ---------- write dist ----------
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const skip = new Set(['dist', 'data', 'src', 'node_modules', '.git', '.pages.yml', 'build.js', 'README.md', 'package.json', '.DS_Store']);
(function copy(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (src === root && skip.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); } else fs.copyFileSync(s, d);
  }
})(root, dist);

let page = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
page = page.replace('    <!--MENU-->\n', menuHtml).replace('<!--HOURS-->', hoursHtml).replace('<!--NOTICE-->', noticeHtml)
  .replace('<!--CONFIG-->', configHtml).replace('<!--FAQ-->', faqHtml).replace('<!--PHONE_BR-->', phoneBr).replace('<!--CONTACT-->', contactHtml)
  .replace('%%LD_PHONE%%', jsonStr(phoneLink)).replace('%%LD_EMAIL%%', jsonStr(contact.email));
fs.writeFileSync(path.join(dist, 'index.html'), page);
console.log(`Built dist/ — ${cats.length} menu categories, hours OK${notice ? ', notice shown' : ''}, ${faqAll.filter((x) => x.active !== false).length} FAQ, ${closures.length} closed-date rules.`);
