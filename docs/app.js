const SIZES = [
  { key: 'X_WING', label: 'X-Wing' },
  { key: 'SWORDFISH', label: 'Swordfish' },
  { key: 'JELLYFISH', label: 'Jellyfish' }
];

const VARIANTS = [
  { prefix: '', label: 'Basic', rarity: {} },
  { prefix: 'FINNED_', label: 'Finned', rarity: {} },
  { prefix: 'SASHIMI_', label: 'Sashimi', rarity: { JELLYFISH: 'rare' } },
  { prefix: 'FRANKEN_', label: 'Franken', rarity: { JELLYFISH: 'rare' } },
  { prefix: 'FINNED_FRANKEN_', label: 'Finned Franken', rarity: { JELLYFISH: 'rare' } },
  { prefix: 'MUTANT_', label: 'Mutant', rarity: { X_WING: 'very rare', SWORDFISH: 'very rare', JELLYFISH: 'very rare' } },
  { prefix: 'FINNED_MUTANT_', label: 'Finned Mutant', rarity: { X_WING: 'very rare', SWORDFISH: 'very rare', JELLYFISH: 'rare' } }
];

const typeName = (variant, size) => variant.label + ' ' + size.label;
const grid = document.getElementById('grid');
const bars = document.getElementById('bars');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const downloadBtn = document.getElementById('download');
const countInput = document.getElementById('count');
const withAnswers = document.getElementById('withAnswers');

const head = document.createElement('tr');
head.innerHTML = '<th></th>' + SIZES.map(s => '<th>' + s.label + '</th>').join('');
grid.appendChild(head);

for (const variant of VARIANTS) {
  const tr = document.createElement('tr');
  const th = document.createElement('td');
  th.textContent = variant.label;
  tr.appendChild(th);
  for (const size of SIZES) {
    const key = variant.prefix + size.key;
    const rarity = variant.rarity[size.key];
    const td = document.createElement('td');
    const label = document.createElement('label');
    label.className = 'cell';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset.type = key;
    box.dataset.name = typeName(variant, size);
    if (key === 'X_WING') box.checked = true;
    label.appendChild(box);
    if (rarity) {
      const tag = document.createElement('span');
      tag.className = 'tag rare';
      tag.textContent = rarity;
      label.appendChild(tag);
    }
    td.appendChild(label);
    tr.appendChild(td);
  }
  grid.appendChild(tr);
}

const boxes = () => Array.from(grid.querySelectorAll('input[type=checkbox]'));
document.getElementById('all').onclick = () => boxes().forEach(b => (b.checked = true));
document.getElementById('none').onclick = () => boxes().forEach(b => (b.checked = false));

let workers = [];
let results = [];
let quotas = {};
let counts = {};
let names = {};
let tried = 0;
let startedAt = 0;
let timer = null;
let seen = new Set();

function elapsed() {
  const s = Math.round((Date.now() - startedAt) / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function renderBars() {
  bars.innerHTML = '';
  for (const type of Object.keys(quotas)) {
    const row = document.createElement('div');
    row.className = 'bar';
    const pct = quotas[type] ? Math.min(100, (100 * counts[type]) / quotas[type]) : 0;
    row.innerHTML = '<span></span><div class="track"><div class="fill"></div></div><span></span>';
    row.children[0].textContent = names[type];
    row.querySelector('.fill').style.width = pct + '%';
    row.children[2].textContent = counts[type] + ' / ' + quotas[type];
    bars.appendChild(row);
  }
}

function renderStatus(prefix) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  statusEl.textContent = (prefix || 'Working') + ': ' + total + ' puzzles found, ' + tried.toLocaleString() + ' generated, ' + elapsed();
}

function finish(message) {
  workers.forEach(w => {
    w.postMessage({ cmd: 'stop' });
    w.terminate();
  });
  workers = [];
  clearInterval(timer);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  downloadBtn.disabled = results.length === 0;
  renderStatus(message);
  renderBars();
}

function allDone() {
  return Object.keys(quotas).every(t => counts[t] >= quotas[t]);
}

function onMessage(event) {
  const { tried: n, found } = event.data;
  tried += n;
  for (const item of found) {
    if (!(item.type in quotas) || counts[item.type] >= quotas[item.type] || seen.has(item.puzzle)) continue;
    seen.add(item.puzzle);
    counts[item.type]++;
    results.push(item);
  }
  if (allDone()) finish('Done');
}

startBtn.onclick = () => {
  const selected = boxes().filter(b => b.checked);
  const total = Math.max(1, Math.min(500, parseInt(countInput.value, 10) || 1));
  if (selected.length === 0) {
    statusEl.innerHTML = '<span class="error">Select at least one fish.</span>';
    return;
  }
  quotas = {};
  counts = {};
  names = {};
  results = [];
  seen = new Set();
  tried = 0;
  const base = Math.floor(total / selected.length);
  const extra = total % selected.length;
  selected.forEach((b, i) => {
    const q = base + (i < extra ? 1 : 0);
    if (q === 0) return;
    quotas[b.dataset.type] = q;
    counts[b.dataset.type] = 0;
    names[b.dataset.type] = b.dataset.name;
  });
  startedAt = Date.now();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  downloadBtn.disabled = true;
  const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  for (let i = 0; i < n; i++) {
    const w = new Worker('worker.js');
    w.onmessage = onMessage;
    w.onerror = () => finish('Worker failed to load');
    w.postMessage({ cmd: 'start' });
    workers.push(w);
  }
  timer = setInterval(() => {
    renderStatus();
    renderBars();
  }, 400);
  renderBars();
};

stopBtn.onclick = () => finish('Stopped');

downloadBtn.onclick = () => {
  const lines = results.map(r => (withAnswers.checked ? [r.puzzle, r.type, r.answer].join('\t') : r.puzzle));
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fish_puzzles.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
