importScripts('wasm-gc-runtime.js');

let generate = null;
let running = false;
let wanted = new Set();
let tried = 0;

async function init() {
  if (generate) return;
  const teavm = await TeaVM.wasmGC.load('fishgen.wasm');
  generate = teavm.exports.generateOne;
}

async function loop() {
  await init();
  running = true;
  while (running) {
    const found = [];
    for (let i = 0; i < 10 && running; i++) {
      const line = generate();
      tried++;
      if (!line) continue;
      const [type, puzzle, answer] = line.split('\t');
      found.push({ type, puzzle, answer });
    }
    postMessage({ tried, found });
    tried = 0;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

onmessage = event => {
  const msg = event.data;
  if (msg.cmd === 'start') {
    if (!running) loop();
  } else if (msg.cmd === 'stop') {
    running = false;
  }
};
