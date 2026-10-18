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
page = page.replace('    <!--MENU-->\n', menuHtml).replace('<!--HOURS-->', hoursHtml).replace('<!--NOTICE-->', noticeHtml);
fs.writeFileSync(path.join(dist, 'index.html'), page);
console.log(`Built dist/ — ${cats.length} menu categories, hours OK${notice ? ', notice shown' : ''}.`);
