// Reconhecimento de voz da versão web/iPhone, fora da thread da tela.
// Whisper base (~80 MB, multilíngue para o botão PT). Fica no cache do navegador depois do 1º download.
import { pipeline, env, Tensor } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
import './whisper-score.js';

env.allowLocalModels = false;

const files = {};
const progress_callback = (p) => {
  if (p.status !== 'progress' || !p.total) return;
  files[p.file] = [p.loaded, p.total];
  const [l, t] = Object.values(files).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
  postMessage({ progress: Math.round(l / t * 100) });
};

const ready = pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', { dtype: 'q8', device: 'wasm', progress_callback });
ready.then(() => postMessage({ progress: 100, ready: true }), (e) => postMessage({ progress: -1, ready: false, error: String(e?.message || e) }));

// Uma inferência por vez.
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));

const ops = {
  transcribe: async (asr, [pcm, language = 'english']) =>
    (await asr(pcm, { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })).text.trim(),
  assess: (asr, [pcm, target]) =>
    globalThis.WhisperScore.assess({ model: asr.model, processor: asr.processor, tokenizer: asr.tokenizer, Tensor }, pcm, target)
};

onmessage = async ({ data: { id, op, args } }) => {
  try {
    const asr = await ready;
    const result = await serial(() => ops[op](asr, args));
    postMessage({ id, ok: true, result });
  } catch (e) {
    postMessage({ id, ok: false, error: String(e?.message || e) });
  }
};
