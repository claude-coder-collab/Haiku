importScripts('wasm-gc-runtime.js');

let api = null;

async function init() {
  if (api) return;
  const teavm = await TeaVM.wasmGC.load('fishgen.wasm');
  api = teavm.exports;
}

onmessage = async event => {
  const msg = event.data;
  await init();
  if (msg.cmd === 'rate') {
    postMessage({ rated: JSON.parse(api.rate(msg.values)) });
    return;
  }
  for (let phase = 0; phase <= 26; phase++) {
    const result = JSON.parse(api.findPhase(msg.values, msg.masks, phase, msg.heavy));
    if (result.error) {
      postMessage({ error: result.error });
      return;
    }
    postMessage({ phase, steps: result });
  }
  postMessage({ done: true });
};
