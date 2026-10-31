const SVG = 'http://www.w3.org/2000/svg';
const CELL = 56;
const OFFSET = 0;
const board = document.getElementById('board');
const explainEl = document.getElementById('explain');
const stepsEl = document.getElementById('steps');
const progressEl = document.getElementById('progress');
const puzzleEl = document.getElementById('puzzle');
const applyBtn = document.getElementById('apply');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const heavyEl = document.getElementById('heavy');
const filterEl = document.getElementById('filter');
const puzzlePanel = document.getElementById('puzzlePanel');
const newPuzzleBtn = document.getElementById('newPuzzle');
const pencilEl = document.getElementById('pencil');

const row = i => Math.floor(i / 9);
const col = i => i % 9;
const box = i => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
const peers = i => {
  const out = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) out.push(j);
  }
  return out;
};
const PEERS = Array.from({ length: 81 }, (_, i) => peers(i));
const houseCells = (type, num) => {
  const n = num - 1;
  const out = [];
  for (let i = 0; i < 81; i++) {
    if ((type === 0 && box(i) === n) || (type === 1 && row(i) === n) || (type === 2 && col(i) === n)) out.push(i);
  }
  return out;
};

let state = null;
let undoStack = [];
let redoStack = [];
let selectedCell = -1;
let steps = [];
let selectedStep = -1;
let worker = null;
let runId = 0;
let renderTimer = null;

const clone = s => ({ values: s.values.slice(), given: s.given.slice(), masks: s.masks.slice() });

function fullMasks(values) {
  const masks = [];
  for (let i = 0; i < 81; i++) {
    if (values[i]) {
      masks.push(0);
      continue;
    }
    let used = 0;
    for (const p of PEERS[i]) if (values[p]) used |= 1 << (values[p] - 1);
    masks.push(511 & ~used);
  }
  return masks;
}

function parsePuzzle(text) {
  const chars = text.replace(/[\s|+\-]/g, '').replace(/[.*_]/g, '0');
  if (!/^[0-9]{81}$/.test(chars)) return null;
  return chars.split('').map(Number);
}

function setState(next, keepHistory) {
  if (!keepHistory) {
    undoStack = [];
    redoStack = [];
  }
  state = next;
  selectedStep = -1;
  refresh();
}

function pushHistory() {
  undoStack.push(clone(state));
  redoStack = [];
}

function place(s, i, d) {
  s.values[i] = d;
  s.masks[i] = 0;
  for (const p of PEERS[i]) s.masks[p] &= ~(1 << (d - 1));
}

function applyStep(step) {
  pushHistory();
  const next = clone(state);
  if (step.single) {
    step.idx.forEach((i, k) => place(next, i, step.vals[k]));
  } else {
    for (const [i, c] of step.del) next.masks[i] &= ~(1 << (c - 1));
  }
  setState(next, true);
}

function stepsFor(values, masks) {
  return { values: values.join(''), masks: masks.join(',') };
}

function startSearch() {
  runId++;
  if (worker) worker.terminate();
  steps = [];
  selectedStep = -1;
  renderSteps();
  if (!state) return;
  if (state.values.every(v => v)) {
    progressEl.textContent = 'Solved.';
    return;
  }
  const id = runId;
  worker = new Worker('hinter-worker.js');
  progressEl.textContent = '(searching...)';
  worker.onmessage = event => {
    if (id !== runId) return;
    const msg = event.data;
    if (msg.error) {
      progressEl.textContent = 'Error: ' + msg.error;
      worker.terminate();
      return;
    }
    if (msg.done) {
      progressEl.textContent = '(' + steps.length + ' found)';
      renderSteps();
      worker.terminate();
      worker = null;
      return;
    }
    for (const st of msg.steps) steps.push(st);
    progressEl.textContent = '(searching ' + Math.round((100 * (msg.phase + 1)) / 27) + '%, ' + steps.length + ' found)';
    scheduleRender();
  };
  worker.onerror = () => {
    progressEl.textContent = 'Worker failed to load.';
  };
  const payload = stepsFor(state.values, state.masks);
  worker.postMessage({ values: payload.values, masks: payload.masks, heavy: heavyEl.checked });
}

function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderSteps();
  }, 120);
}

function groupSteps() {
  const filter = filterEl.value.trim().toLowerCase();
  const groups = new Map();
  steps.forEach((st, index) => {
    if (filter && !(st.name + ' ' + st.text).toLowerCase().includes(filter)) return;
    if (!groups.has(st.cat)) groups.set(st.cat, []);
    groups.get(st.cat).push(index);
  });
  const list = Array.from(groups.entries()).map(([cat, idxs]) => {
    idxs.sort((a, b) => steps[a].score - steps[b].score || steps[a].text.localeCompare(steps[b].text));
    return { cat, idxs, order: steps[idxs[0]].score };
  });
  list.sort((a, b) => a.order - b.order);
  return list;
}

function renderSteps() {
  stepsEl.innerHTML = '';
  for (const g of groupSteps()) {
    const wrap = document.createElement('div');
    wrap.className = 'group';
    const head = document.createElement('div');
    head.className = 'ghead';
    head.innerHTML = '<div></div><span></span>';
    head.firstChild.textContent = g.cat || 'Other';
    head.lastChild.textContent = g.idxs.length;
    wrap.appendChild(head);
    for (const index of g.idxs) {
      const st = steps[index];
      const el = document.createElement('div');
      el.className = 'step' + (index === selectedStep ? ' on' : '');
      const label = document.createElement('div');
      label.textContent = st.text;
      el.appendChild(label);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Apply';
      btn.onclick = e => {
        e.stopPropagation();
        applyStep(st);
      };
      el.appendChild(btn);
      el.onclick = () => selectStep(index);
      wrap.appendChild(el);
    }
    stepsEl.appendChild(wrap);
  }
}

function selectStep(index) {
  selectedStep = selectedStep === index ? -1 : index;
  renderSteps();
  drawBoard();
  applyBtn.disabled = selectedStep < 0;
  explainEl.textContent = selectedStep < 0 ? '' : steps[selectedStep].text;
  if (selectedStep >= 0) document.querySelector('.boardcard').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function el(name, attrs, text) {
  const node = document.createElementNS(SVG, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

function candCenter(i, d) {
  const cx = OFFSET + col(i) * CELL + CELL / 2 + ((d - 1) % 3 - 1) * (CELL / 3);
  const cy = OFFSET + row(i) * CELL + CELL / 2 + (Math.floor((d - 1) / 3) - 1) * (CELL / 3);
  return [cx, cy];
}

function highlightsFor(step) {
  const h = { cellCls: Array.from({ length: 81 }, () => []), role: new Map(), setCell: new Map(), links: [], nodes: [] };
  if (!step) return h;
  const digits = step.single ? [] : step.vals;
  for (const [t, n] of step.cover) for (const i of houseCells(t, n)) h.cellCls[i].push('hl-cover');
  for (const [t, n] of step.base) for (const i of houseCells(t, n)) h.cellCls[i].push('hl-base');
  if (step.single) {
    step.idx.forEach((i, k) => h.setCell.set(i, step.vals[k]));
  } else {
    for (const i of step.idx) h.cellCls[i].push('hl-idx');
    const patternCells = step.base.length ? step.base.flatMap(([t, n]) => houseCells(t, n)) : step.idx;
    for (const i of patternCells) {
      for (const d of digits) if (state.masks[i] & (1 << (d - 1))) h.role.set(i * 10 + d, 'pat');
    }
  }
  step.alses.forEach((a, k) => a.i.forEach(i => h.cellCls[i].push('als' + (k % 4))));
  for (const [i, c] of step.colors) {
    h.cellCls[i].push('col' + (c % 2));
    if (digits.length) h.role.set(i * 10 + digits[0], 'node');
  }
  for (const [i, c] of step.fins) h.role.set(i * 10 + c, 'fin');
  for (const [i, c] of step.endo) h.role.set(i * 10 + c, 'endo');
  for (const [i, c] of step.cann) h.role.set(i * 10 + c, 'cann');
  for (const [i, c] of step.del) h.role.set(i * 10 + c, 'del');
  for (const chain of step.chains) {
    chain.forEach((node, k) => {
      for (const i of node.c) {
        if (!h.role.has(i * 10 + node.d)) h.role.set(i * 10 + node.d, 'node');
      }
      if (k > 0) {
        const prev = chain[k - 1];
        h.links.push({ from: candCenter(prev.c[0], prev.d), to: candCenter(node.c[0], node.d), strong: node.s });
      }
    });
  }
  return h;
}

function drawBoard() {
  if (!state) {
    board.innerHTML = "";
    for (let k = 0; k <= 9; k++) {
      const cls = k % 3 === 0 ? "grid-thick" : "grid-thin";
      board.appendChild(el("line", { x1: k * CELL, y1: 0, x2: k * CELL, y2: 9 * CELL, class: cls }));
      board.appendChild(el("line", { x1: 0, y1: k * CELL, x2: 9 * CELL, y2: k * CELL, class: cls }));
    }
    return;
  }
  board.innerHTML = '';
  const step = selectedStep >= 0 ? steps[selectedStep] : null;
  const h = highlightsFor(step);
  for (let i = 0; i < 81; i++) {
    const x = OFFSET + col(i) * CELL;
    const y = OFFSET + row(i) * CELL;
    const g = el('g', { 'data-cell': i });
    g.appendChild(el('rect', { x, y, width: CELL, height: CELL, class: 'cellbg' + (i === selectedCell ? ' sel' : '') }));
    for (const cls of h.cellCls[i]) g.appendChild(el('rect', { x, y, width: CELL, height: CELL, class: cls }));
    if (h.setCell.has(i)) g.appendChild(el('rect', { x, y, width: CELL, height: CELL, class: 'hl-set' }));
    board.appendChild(g);
  }
  for (let k = 0; k <= 9; k++) {
    const cls = k % 3 === 0 ? 'grid-thick' : 'grid-thin';
    board.appendChild(el('line', { x1: OFFSET + k * CELL, y1: OFFSET, x2: OFFSET + k * CELL, y2: OFFSET + 9 * CELL, class: cls }));
    board.appendChild(el('line', { x1: OFFSET, y1: OFFSET + k * CELL, x2: OFFSET + 9 * CELL, y2: OFFSET + k * CELL, class: cls }));
  }
  for (const l of h.links) {
    board.appendChild(el('line', { x1: l.from[0], y1: l.from[1], x2: l.to[0], y2: l.to[1], class: 'link' + (l.strong ? '' : ' weak') }));
  }
  for (let i = 0; i < 81; i++) {
    const cx = OFFSET + col(i) * CELL + CELL / 2;
    const cy = OFFSET + row(i) * CELL + CELL / 2;
    if (h.setCell.has(i)) {
      board.appendChild(el('text', { x: cx, y: cy, class: 'val setv' }, String(h.setCell.get(i))));
    } else if (state.values[i]) {
      board.appendChild(el('text', { x: cx, y: cy, class: 'val' + (state.given[i] ? '' : ' user') }, String(state.values[i])));
    } else {
      for (let d = 1; d <= 9; d++) {
        const present = state.masks[i] & (1 << (d - 1));
        const role = h.role.get(i * 10 + d);
        if (!present && !role) continue;
        const [px, py] = candCenter(i, d);
        if (role) board.appendChild(el('circle', { cx: px, cy: py, r: 8.5, class: 'dot ' + role }));
        board.appendChild(el('text', { x: px, y: py, class: 'cand' + (role ? ' ' + role : '') }, String(d)));
      }
    }
  }
}

function refresh() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
  applyBtn.disabled = true;
  explainEl.textContent = '';
  drawBoard();
  startSearch();
}

function load(text) {
  const values = parsePuzzle(text);
  if (!values) {
    explainEl.textContent = 'Expected 81 characters (1-9, with . or 0 for empty).';
    return;
  }
  setState({ values: values.slice(), given: values.map(v => v > 0), masks: fullMasks(values) }, false);
  puzzlePanel.hidden = true;
  newPuzzleBtn.hidden = false;
}

board.addEventListener('click', e => {
  const g = e.target.closest('[data-cell]');
  if (!g) return;
  selectedCell = Number(g.getAttribute('data-cell'));
  drawBoard();
});

document.addEventListener('keydown', e => {
  if (!state || selectedCell < 0 || ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) return;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (m) {
    const d = Number(m[1]);
    const i = selectedCell;
    if (state.given[i]) return;
    pushHistory();
    const next = clone(state);
    if (e.shiftKey || pencilEl.checked) {
      if (next.values[i]) return;
      next.masks[i] ^= 1 << (d - 1);
    } else {
      place(next, i, d);
    }
    setState(next, true);
    e.preventDefault();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    const i = selectedCell;
    if (state.given[i] || !state.values[i]) return;
    pushHistory();
    const next = clone(state);
    next.values[i] = 0;
    next.masks = fullMasks(next.values);
    setState(next, true);
    e.preventDefault();
  } else if (e.key.startsWith('Arrow')) {
    const dr = { ArrowUp: -1, ArrowDown: 1 }[e.key] || 0;
    const dc = { ArrowLeft: -1, ArrowRight: 1 }[e.key] || 0;
    const r = Math.min(8, Math.max(0, row(selectedCell) + dr));
    const c = Math.min(8, Math.max(0, col(selectedCell) + dc));
    selectedCell = r * 9 + c;
    drawBoard();
    e.preventDefault();
  }
});

applyBtn.onclick = () => {
  if (selectedStep >= 0) applyStep(steps[selectedStep]);
};
undoBtn.onclick = () => {
  if (!undoStack.length) return;
  redoStack.push(clone(state));
  setState(undoStack.pop(), true);
};
redoBtn.onclick = () => {
  if (!redoStack.length) return;
  undoStack.push(clone(state));
  setState(redoStack.pop(), true);
};
document.getElementById('refill').onclick = () => {
  if (!state) return;
  pushHistory();
  const next = clone(state);
  next.masks = fullMasks(next.values);
  setState(next, true);
};
document.getElementById('load').onclick = () => load(puzzleEl.value);
heavyEl.onchange = () => startSearch();
filterEl.oninput = () => renderSteps();

newPuzzleBtn.onclick = () => {
  puzzlePanel.hidden = false;
  puzzleEl.focus();
  puzzleEl.select();
};

const initial = new URLSearchParams(location.search).get('p');
if (initial) {
  puzzleEl.value = initial;
  load(initial);
} else {
  drawBoard();
}
