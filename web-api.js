// Versão web/iPhone: implementa a mesma window.api que o preload.js do Electron expõe,
// usando só recursos do navegador. No app de PC o preload já definiu window.api e este arquivo não faz nada.
(function () {
  if (window.api) return;

  // ---------- API key (fica só neste aparelho) ----------
  const KEY = 'talkready-key';
  const getKey = () => localStorage.getItem(KEY);

  // ---------- Claude, direto do navegador ----------
  async function post(body, key) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      });
    } catch { throw new Error('Sem conexão com a API do Claude. Verifique a internet.'); }
    const data = await r.json().catch(() => ({}));
    if (r.ok) return data;
    const e = new Error(data?.error?.message || `Erro ${r.status} na API do Claude.`);
    e.status = r.status;
    if (r.status === 401) e.message = 'API key inválida. Confira em Ajustes.';
    if (r.status === 429) e.message = 'Muitas requisições agora. Espere um pouco e tente de novo.';
    throw e;
  }

  async function ai(kind, payload) {
    const key = getKey();
    if (!key) throw new Error('Cadastre sua API key do Claude em Ajustes.');
    let res;
    try { res = await post(TR_PROMPTS.request(kind, payload), key); } catch (e) {
      if (e.status !== 400) throw e;
      res = await post(TR_PROMPTS.request(kind, payload, { withEffort: false }), key); // plano B sem effort
    }
    if (res.stop_reason === 'refusal') throw new Error('O modelo recusou esse pedido. Tente reformular.');
    if (res.stop_reason === 'max_tokens') throw new Error('A resposta veio cortada. Tente de novo.');
    return JSON.parse(res.content.find((b) => b.type === 'text').text);
  }

  // ---------- Voz que ouve: Whisper num worker ----------
  const worker = new Worker('asr-worker.js', { type: 'module' });
  const pending = new Map(), progressFns = [];
  let seq = 0, readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  worker.onmessage = ({ data }) => {
    if ('progress' in data) progressFns.forEach((fn) => fn(data.progress));
    if ('ready' in data) { if (data.error) console.error(data.error); readyResolve(data.ready); }
    if (data.id && pending.has(data.id)) {
      const { res, rej } = pending.get(data.id); pending.delete(data.id);
      data.ok ? res(data.result) : rej(new Error(data.error));
    }
  };
  worker.onerror = (e) => { console.error(e); readyResolve(false); };
  const run = (op, ...args) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); worker.postMessage({ id, op, args }); });

  // ---------- Gravações do Raio-X (IndexedDB) ----------
  const db = new Promise((res, rej) => {
    const r = indexedDB.open('talkready', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('gravacoes');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const store = async (mode, fn) => {
    const tx = (await db).transaction('gravacoes', mode), req = fn(tx.objectStore('gravacoes'));
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  };

  window.api = {
    platform: 'web',
    nativeVoice: true, // fala com as vozes do aparelho (Kokoro é pesado demais para o celular)
    hasKey: async () => Boolean(getKey()),
    setKey: async (k) => { localStorage.setItem(KEY, String(k).trim()); return true; },
    ai,
    speechReady: () => ready,
    onSpeechProgress: (fn) => progressFns.push(fn),
    transcribe: (pcm, lang) => run('transcribe', pcm, lang),
    assess: (pcm, target) => run('assess', pcm, target),
    speak: () => Promise.reject(new Error('Use a voz do aparelho.')),
    dailyAudio: () => Promise.reject(new Error('Indisponível no navegador.')),
    onAudioProgress: () => {},
    saveFile: (name, data) => store('readwrite', (s) => s.put(new Blob([data]), name)),
    readFile: async (name) => (await store('readonly', (s) => s.get(name))).arrayBuffer(),
    setReminder: async () => false
  };
})();
