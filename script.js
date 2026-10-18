// Morgan Wang — portfolio behaviour: entrances, project write-ups, metronome, 3D viewers.

// Entrances
const hero = document.querySelector('.hero');
requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));

const watched = document.querySelectorAll('[data-rise], .footer');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  watched.forEach((el) => io.observe(el));
} else {
  watched.forEach((el) => el.classList.add('is-in'));
}

// Project write-ups open in a full-screen dialog. Each one gets its own history
// entry, so the browser's Back button closes it instead of leaving the site.
const projects = ['telemetry', 'imd', 'buck', 'metronome'];
let openId = null;
const openProject = (id, push = true) => {
  const d = document.getElementById('d-' + id);
  if (!d || typeof d.showModal !== 'function') return false;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  openId = id;
  if (push) history.pushState({ project: id }, '', '#' + id);
  return true;
};
document.querySelectorAll('[data-open]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (openProject(a.dataset.open)) e.preventDefault();
  });
});
document.querySelectorAll('.sheet-dialog').forEach((d) => {
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => {
    const id = d.id.slice(2);
    // Already switched to another project with a Next button
    if (openId !== id) return;
    openId = null;
    // Closed with the button or Esc: step back over the entry we pushed.
    if (history.state && history.state.project === id) history.back();
  });
});
// Next project: swap write-ups in place, so Back still returns to the page
document.querySelectorAll('[data-next]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const current = a.closest('.sheet-dialog');
    const id = a.dataset.next;
    if (!openProject(id, false)) return;
    e.preventDefault();
    current.close();
    history.replaceState({ project: id }, '', '#' + id);
  });
});
window.addEventListener('popstate', () => {
  const id = location.hash.slice(1);
  const current = document.querySelector('.sheet-dialog[open]');
  if (current && current.id !== 'd-' + id) { openId = null; current.close(); }
  if (projects.includes(id)) openProject(id, false);
});
// Tabs: the menu shows one section at a time instead of one long page
const tabs = {
  top: document.getElementById('top'),
  projects: document.getElementById('projects'),
  experience: document.getElementById('experience'),
  contact: document.getElementById('contact'),
};
const showTab = (name) => {
  for (const [key, el] of Object.entries(tabs)) el.hidden = key !== name;
  document.querySelectorAll('.topbar a[href^="#"]').forEach((a) => {
    if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
};
document.body.classList.add('tabbed');
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  const name = a.getAttribute('href').slice(1);
  if (!(name in tabs)) return;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (tabs[name].hidden) {
      showTab(name);
      history.pushState({ tab: name }, '', name === 'top' ? location.pathname : '#' + name);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });
});
window.addEventListener('popstate', () => {
  const name = location.hash.slice(1) || 'top';
  if (name in tabs && tabs[name].hidden) showTab(name);
});

const initial = location.hash.slice(1);
if (projects.includes(initial)) {
  history.replaceState(null, '', '#projects');
  showTab('projects');
  openProject(initial);
} else {
  showTab(initial in tabs ? initial : 'top');
}

// Menu bar: collapsible list of links on phones
(() => {
  const btn = document.querySelector('.topbar-menu');
  const links = document.getElementById('topbar-links');
  if (!btn || !links) return;
  const set = (open) => { btn.setAttribute('aria-expanded', String(open)); links.classList.toggle('is-open', open); btn.textContent = open ? 'Close' : 'Menu'; };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
})();

// Metronome — same behaviour as MorgansMetronome.ino
(() => {
  const l1 = document.getElementById('lcd1');
  const l2 = document.getElementById('lcd2');
  const led = document.getElementById('m-led');
  const pot = document.getElementById('m-bpm');
  const patternOptions = [4, 5, 6, 7, 2, 3];
  let patternIndex = 0;
  let bpm = Number(pot.value);
  let running = false;
  let currentBeat = 0;
  let nextBeatTime = 0;
  let timer = null;
  let ctx = null;

  const cells = (el) => {
    el.innerHTML = '';
    for (let i = 0; i < 16; i++) el.appendChild(document.createElement('span'));
    return [...el.children];
  };
  const row1 = cells(l1);
  const row2 = cells(l2);
  const print = (row, text) => {
    const t = text.padEnd(16).slice(0, 16);
    row.forEach((c, i) => { c.textContent = t[i] === ' ' ? '' : t[i]; });
  };
  const render = () => {
    print(row1, running ? 'RUNNING' : 'METRONOME');
    print(row2, `BPM: ${bpm}  ${patternOptions[patternIndex]} BP`);
    l1.setAttribute('aria-label', running ? 'Running' : 'Metronome');
    l2.setAttribute('aria-label', `${bpm} beats per minute, ${patternOptions[patternIndex]} beat pattern`);
  };

  const click = (time, accent) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 400 : 200;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.setValueAtTime(0, time + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.07);
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      led.classList.add('on');
      setTimeout(() => led.classList.remove('on'), 60);
    }, delay);
  };

  // Look-ahead scheduler, the browser equivalent of the millis() loop
  const schedule = () => {
    while (nextBeatTime < ctx.currentTime + 0.1) {
      click(nextBeatTime, currentBeat === 0);
      currentBeat = (currentBeat + 1) % patternOptions[patternIndex];
      nextBeatTime += 60 / bpm;
    }
  };

  document.getElementById('m-start').addEventListener('click', () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    running = !running;
    if (running) {
      currentBeat = 0;
      nextBeatTime = ctx.currentTime + 0.05;
      timer = setInterval(schedule, 25);
      schedule();
    } else {
      clearInterval(timer);
      led.classList.remove('on');
    }
    render();
  });

  document.getElementById('m-pattern').addEventListener('click', () => {
    patternIndex = (patternIndex + 1) % patternOptions.length;
    currentBeat = 0;
    render();
  });

  pot.addEventListener('input', () => {
    bpm = Math.round(Number(pot.value) / 5) * 5;
    render();
  });

  render();
})();

// 3D board viewers: preset views
document.querySelectorAll('.viewer-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mv = document.getElementById(btn.dataset.mv);
    if (!mv) return;
    mv.cameraOrbit = btn.dataset.orbit;
    mv.cameraTarget = 'auto auto auto';
  });
});

// Click a photo in a write-up to see it full size; arrows step through that project's photos
(() => {
  const lb = document.getElementById('lightbox');
  if (!lb || typeof lb.showModal !== 'function') return;
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-cap');
  const prev = lb.querySelector('.lb-prev');
  const next = lb.querySelector('.lb-next');
  const sel = '.d-hero img, .d-figure img, .d-gallery img, .list-figure img';
  let set = [];
  let i = 0;
  const show = () => {
    const el = set[i];
    img.src = el.currentSrc || el.src;
    img.alt = el.alt;
    const fc = el.closest('figure') && el.closest('figure').querySelector('figcaption');
    cap.textContent = fc ? fc.textContent : el.alt;
    prev.hidden = next.hidden = set.length < 2;
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest(sel);
    if (!el) return;
    const scope = el.closest('.sheet-dialog') || el.closest('figure');
    set = [...scope.querySelectorAll(sel)];
    i = set.indexOf(el);
    show();
    lb.showModal();
  });
  const step = (d) => { i = (i + d + set.length) % set.length; show(); };
  prev.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  next.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  lb.querySelector('.lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target === img || e.target.classList.contains('lb-figure')) lb.close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  // Closing the photo must not close the project underneath
  lb.addEventListener('cancel', (e) => e.stopPropagation());
})();

// Clicking a picture in the opening image wall opens that picture's project
document.querySelectorAll('.sheet .frame').forEach((f) => {
  const img = f.querySelector('img');
  const m = img && img.getAttribute('src').match(/\/(buck|imd|met|tel)-/);
  if (!m) return;
  const id = { met: 'metronome', tel: 'telemetry' }[m[1]] || m[1];
  f.classList.add('is-link');
  f.addEventListener('click', () => openProject(id));
});
