// ─────────────────────────────────────────────────────────────
// EDIT: the Bopple ordering link. Every "Order online" button uses it.
// Leave empty until the store is live (buttons then scroll to the menu).
// ─────────────────────────────────────────────────────────────
const ORDER_URL = '';   // Bopple: 'https://bopple.app/15717/' once the subscription is active

// While ORDER_URL is empty, "Order online" buttons read "Book your event" and open the catering site.
const EVENT_URL = 'https://basilicopizzacatering.com.au';

// EDIT: Google Analytics 4 measurement ID, e.g. 'G-XXXXXXXXXX'. Empty = no analytics loaded.
const GA_ID = 'G-P5V4D96V0S';

if (GA_ID) {
  const s = document.createElement('script');
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date()); gtag('config', GA_ID);
}

// Closed dates (from data/site.json via window.SITE_CONFIG): an automatic banner while a rule is active.
const CFG = window.SITE_CONFIG || {};
// Today's date (YYYY-MM-DD) in the business time zone. ?today=2026-12-25 previews another day (testing only).
function todayKey() {
  const q = new URLSearchParams(location.search).get('today');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.timezone || 'Australia/Sydney' }).format(new Date());
}
const within = (day, from, to) => (!from || day >= from) && (!to || day <= to);

document.addEventListener('DOMContentLoaded', () => {
  const activeClosure = (CFG.closures || []).find((c) => within(todayKey(), c.from, c.to));
  if (activeClosure) {
    const b = document.createElement('div');
    b.className = `notice notice--${activeClosure.style === 'info' ? 'info' : 'alert'}`;
    b.setAttribute('role', 'status');
    b.textContent = activeClosure.message;
    const hdr = document.querySelector('header');
    (hdr || document.body).insertAdjacentElement(hdr ? 'afterend' : 'afterbegin', b);
  }

  // Order buttons: "Order online" once ordering is live, otherwise "Book your event"
  document.querySelectorAll('.js-order').forEach((a) => {
    a.href = ORDER_URL || EVENT_URL;
    a.textContent = ORDER_URL ? 'Order online' : 'Book your event';
    a.target = '_blank';
    a.rel = 'noopener';
  });
  // elements that only make sense when ordering is live (e.g. the button under the menu)
  document.querySelectorAll('.js-orderonly').forEach((el) => { el.hidden = !ORDER_URL; });

  // Read the hours table: "17:00–21:00" or "Closed"
  const rows = [...document.querySelectorAll('#hours tbody tr')].map((tr) => {
    const day = tr.querySelector('th').textContent.trim();
    const m = tr.querySelector('td').textContent.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    const pad = (t) => t.padStart(5, '0');
    return { day, open: m ? pad(m[1]) : null, close: m ? pad(m[2]) : null };
  });
  const hasHours = rows.some((r) => r.open);

  // Hero line, in Sydney time
  const today = document.getElementById('today');
  if (today && hasHours) {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
    const row = rows.find((r) => r.day === get('weekday'));
    const now = `${get('hour')}:${get('minute')}`;
    if (!row?.open) today.textContent = 'Closed today';
    else if (now < row.open) today.textContent = `Opens today at ${row.open}`;
    else if (now < row.close) today.textContent = `Open now · until ${row.close}`;
    else today.textContent = 'Closed for today';
  }

  // Footer hours summary: groups of days with the same hours, e.g. "Mon–Fri 17:00–22:30 · Sat–Sun 17:00–23:00"
  const fh = document.getElementById('ftr-hours');
  if (fh && hasHours) {
    const groups = [];
    rows.forEach((r) => {
      const t = r.open ? `${r.open}–${r.close}` : 'Closed';
      const last = groups[groups.length - 1];
      if (last && last.t === t) last.end = r.day; else groups.push({ start: r.day, end: r.day, t });
    });
    const ab = (d) => d.slice(0, 3);
    fh.textContent = groups.map((g) => `${g.start === g.end ? ab(g.start) : `${ab(g.start)}–${ab(g.end)}`} ${g.t}`).join(' · ');
  }

  // Opening hours into the Google business details
  const ld = document.getElementById('business');
  if (ld && hasHours) {
    const data = JSON.parse(ld.textContent);
    data.openingHours = rows.filter((r) => r.open).map((r) => `${r.day.slice(0, 2)} ${r.open}-${r.close}`);
    ld.textContent = JSON.stringify(data);
  }

  // Contact form (Netlify Forms, sent in the background so the visitor stays on the page)
  const form = document.getElementById('contact-form');
  const status = document.getElementById('contact-status');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (location.protocol === 'file:') { status.textContent = 'The form only works on the live site.'; return; }
      status.textContent = 'Sending…';
      try {
        const res = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!res.ok) throw new Error();
        form.reset();
        status.textContent = 'Grazie! Message sent, we\'ll get back to you soon.';
        if (window.gtag) gtag('event', 'contact_form_sent');
      } catch {
        status.textContent = 'Something went wrong. Please try again or contact us on Instagram.';
      }
    });
  }

  // Track clicks on Order online / Directions (only if analytics is on)
  document.querySelectorAll('.js-order, .js-maps').forEach((a) => a.addEventListener('click', () => {
    if (window.gtag) gtag('event', a.classList.contains('js-order') ? 'order_click' : 'directions_click');
  }));

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
});
