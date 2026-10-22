// Тёплый угол — what is in the oven right now, and how long until it gets light on the island.

const ISLAND = { lat: 59.941, lng: 30.271 }; // 8-я линия у Среднего проспекта
const OPEN = 7 * 60, CLOSE = 21 * 60, OVEN = 6 * 60;

const NB = '\u00A0';
const clock = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const hm = (min) => clock.format(new Date(Date.UTC(2000, 0, 1, Math.floor(min / 60), min % 60)));
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const spell = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}${NB}мин`;
  return m ? `${h}${NB}ч ${m}${NB}мин` : `${h}${NB}ч`;
};
const list = (names) => names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} и ${names.at(-1)}`;

// minutes since midnight on the island
function islandMinutes(date) {
  const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

// sunrise and sunset for the island, as minutes since midnight Moscow time (sunrise equation)
function sun(date) {
  const rad = Math.PI / 180;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545 + 0.0008);
  const jStar = n - ISLAND.lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const decl = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(ISLAND.lat * rad) * Math.sin(decl)) / (Math.cos(ISLAND.lat * rad) * Math.cos(decl));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / rad;
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  return { rise: islandMinutes(toDate(transit - w / 360)), set: islandMinutes(toDate(transit + w / 360)) };
}

// the bake, read from the menu itself
const rows = [...document.querySelectorAll('.menu__table tr[data-out]')];
const batches = new Map();
rows.forEach((row) => row.dataset.out.split(',').forEach((t) => {
  const at = toMin(t);
  if (!batches.has(at)) batches.set(at, []);
  batches.get(at).push(row.dataset.name);
}));
const times = [...batches.keys()].sort((a, b) => a - b);

const live = document.querySelector('.live__js');
const staticLine = document.querySelector('.live__static');

function render() {
  const now = new Date();
  const t = islandMinutes(now);
  const s = sun(now);

  let light = '';
  if (s && t < s.rise) light = `, до рассвета ещё ${spell(s.rise - t)}`;
  else if (s && t < s.set) light = `, рассвело в ${hm(s.rise)}`;
  else if (s) light = ', уже стемнело';

  const last = [...times].reverse().find((x) => x <= t);
  const next = times.find((x) => x > t);
  let say;
  if (t < OVEN) {
    say = `Печь пока холодная: затопим в 06:00, двери откроем в 07:00.`;
  } else if (t < OPEN) {
    say = `Печь уже горит. Двери откроем в 07:00 вместе с первым пшеничным и багетами.`;
  } else if (t >= CLOSE) {
    say = `Мы закрылись в 21:00. Завтра печь затопим в 06:00, первый хлеб будет в 07:00.`;
  } else if (last === undefined) {
    say = next !== undefined
      ? `Первыми из печи выйдут ${list(batches.get(next))} в ${hm(next)}, <span class="soon">через ${spell(next - t)}</span>.`
      : `Открыто до 21:00.`;
  } else if (next !== undefined) {
    say = `Последними из печи вышли ${list(batches.get(last))} в ${hm(last)}. Следом — ${list(batches.get(next))} в ${hm(next)}, <span class="soon">через ${spell(next - t)}</span>.`;
  } else {
    say = `На сегодня всё испечено, последними вышли ${list(batches.get(last))} в ${hm(last)}. Открыто до 21:00.`;
  }

  live.innerHTML = `<strong>${hm(t)}</strong> на острове${light}. ${say}`;
  live.hidden = false;
  staticLine.hidden = true;

  // mark the menu: on the shelf, next out of the oven, later today
  const open = t >= OPEN && t < CLOSE;
  rows.forEach((row) => {
    const outs = row.dataset.out.split(',').map(toMin);
    const timeCell = row.querySelector('.t');
    timeCell.textContent = timeCell.dataset.base ??= timeCell.textContent;
    row.classList.remove('is-later', 'is-next');
    if (!open) return;
    if (outs.every((x) => x > t)) row.classList.add('is-later');
    if (next !== undefined && outs.includes(next)) {
      row.classList.add('is-next');
      timeCell.textContent = `${hm(next)}, через ${spell(next - t)}`;
    }
  });
}

if (live) {
  render();
  setInterval(render, 30000);
}

// entrances: once, never leaving anything hidden
document.querySelectorAll('.menu__group').forEach((g) => {
  g.setAttribute('data-reveal-group', '');
  g.querySelectorAll('tbody tr').forEach((tr, i) => tr.style.setProperty('--i', i));
});
const targets = document.querySelectorAll('[data-reveal], [data-reveal-group]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  targets.forEach((el) => io.observe(el));
} else {
  targets.forEach((el) => el.classList.add('is-in'));
}
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('loaded')));
window.addEventListener('load', () => setTimeout(() => {
  targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); });
}, 2500));

// fit the address and the wordmark from margin to margin
function fit() {
  const boxes = [...document.querySelectorAll('svg.fit')].map((svg) => {
    try { return [svg, svg.querySelector('text').getBBox()]; } catch { return [svg, null]; }
  });
  for (const [svg, b] of boxes) if (b?.width) svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
}
fit();
document.fonts?.ready.then(fit);

// the snow loop starts by itself; where the browser refuses to play video
// (iPhone in Low Power Mode), the same scene runs as an animated image instead
const video = document.querySelector('.panel video');
if (video) {
  let fallen = false;
  const fallBack = () => {
    if (fallen) return;
    fallen = true;
    const img = new Image();
    img.className = video.className;
    img.src = 'assets/snow-under-led-street-light-in-tuntorp-loop.webp';
    img.alt = '';
    img.width = 640;
    img.height = 360;
    img.decoding = 'async';
    video.replaceWith(img);
  };
  const start = () => {
    if (fallen) return;
    video.muted = true;
    const attempt = video.play();
    if (attempt) attempt.catch((err) => { if (err?.name === 'NotAllowedError') fallBack(); });
  };
  video.addEventListener('error', fallBack);
  video.querySelector('source:last-of-type')?.addEventListener('error', fallBack);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { if (fallen) return; e.isIntersecting ? start() : video.pause(); }).observe(video);
  } else {
    start();
  }
}
