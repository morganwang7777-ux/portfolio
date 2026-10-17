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

// Project write-ups open in a full-screen dialog
const openProject = (id) => {
  const d = document.getElementById('d-' + id);
  if (!d || typeof d.showModal !== 'function') return false;
  d.showModal();
  d.scrollTop = 0;
  history.replaceState(null, '', '#' + id);
  return true;
};
document.querySelectorAll('[data-open]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (openProject(a.dataset.open)) e.preventDefault();
  });
});
document.querySelectorAll('.sheet-dialog').forEach((d) => {
  d.querySelector('[data-close]').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => history.replaceState(null, '', location.pathname));
});
const initial = location.hash.slice(1);
if (['imd', 'buck', 'metronome'].includes(initial)) openProject(initial);

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
