// Gera os áudios dos módulos com o VoiceStudio (precisa estar aberto, API em :3900) e confere cada fala com o Whisper.
// Uso (na pasta do app):  node_modules\electron\dist\electron.exe ferramentas\gerar-modulos.cjs
// Só gera o que falta em modulos/. Take reprovado (Whisper não entende) é refeito com outra semente.
const { app, net } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'modulos');
const VS = 'http://127.0.0.1:3900';
const VOICES = { A: 'cb91d092', B: '70b88693' }; // perfis VoiceStudio: TR Sarah (EUA), TR George (UK)
const FFMPEG = path.join(process.env.LOCALAPPDATA, 'ffmpeg', 'ffmpeg-9.0.2-essentials_build', 'bin', 'ffmpeg.exe');
const MAX_WER = 0.1, TRIES = 5;
const MODULES = require(path.join(ROOT, 'modules.js'));

const nodeFetch = globalThis.fetch; // VoiceStudio é local: fetch do Node
globalThis.fetch = (u, i) => net.fetch(u, i); // transformers.js: rede do Chromium (certificados do Windows)

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const a = norm(ref), b = norm(hyp), d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] / a.length;
}
function wavTo16k(file) {
  const b = fs.readFileSync(file); let rate = 24000, data;
  for (let i = 12; i < b.length - 8;) { const id = b.toString('ascii', i, i + 4), sz = b.readUInt32LE(i + 4); if (id === 'fmt ') rate = b.readUInt32LE(i + 12); if (id === 'data') { data = b.subarray(i + 8, i + 8 + sz); break; } i += 8 + sz + (sz % 2); }
  const src = new Float32Array(data.length / 2); for (let k = 0; k < src.length; k++) src[k] = data.readInt16LE(k * 2) / 32768;
  const r = rate / 16000, out = new Float32Array(Math.floor(src.length / r));
  for (let i = 0; i < out.length; i++) { const x = i * r, j = Math.floor(x), f = x - j; out[i] = src[j] * (1 - f) + (src[j + 1] || 0) * f; }
  return out;
}
async function synth(text, profile, seed, file) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ text, language: 'en', profile_id: profile, effect_preset: 'raw', num_step: '32', guidance_scale: '2.5', seed: String(seed), speed: '0.9' })) fd.append(k, v);
  const res = await nodeFetch(`${VS}/generate`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`VoiceStudio ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

app.whenReady().then(async () => {
  const { env, pipeline } = require(path.join(ROOT, 'node_modules', '@huggingface', 'transformers'));
  env.cacheDir = path.join(process.env.LOCALAPPDATA, 'TalkReady', 'models');
  const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', { dtype: 'q8', device: 'cpu' });
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-mod-'));
  const report = [];
  const jobs = MODULES.flatMap((m) => [
    ...m.lines.map(([who, en], i) => ({ name: `m${String(m.id).padStart(2, '0')}-d${String(i + 1).padStart(2, '0')}`, en, profile: VOICES[who] })),
    ...m.phrases.map(([en], i) => ({ name: `m${String(m.id).padStart(2, '0')}-f${String(i + 1).padStart(2, '0')}`, en, profile: VOICES.A }))
  ]);
  for (const [n, job] of jobs.entries()) {
    const dest = path.join(OUT, `${job.name}.ogg`);
    if (fs.existsSync(dest)) continue;
    let best = null;
    for (let t = 0; t < TRIES; t++) {
      const wav = path.join(tmp, `${job.name}-${t}.wav`);
      try { await synth(job.en, job.profile, 11 + t * 17, wav); } catch (e) { console.log('ERRO', job.name, e.message); continue; }
      const heard = (await asr(wavTo16k(wav), { language: 'english', task: 'transcribe' })).text.trim(), w = wer(job.en, heard);
      if (!best || w < best.w) best = { wav, w, heard, tries: t + 1 };
      if (w <= MAX_WER) break;
    }
    if (!best) continue;
    // corta silêncio das pontas, deixa 120 ms de respiro e iguala o volume entre as vozes
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', best.wav, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=120,apad=pad_dur=0.15,loudnorm=I=-18:TP=-1.5', '-ac', '1', '-c:a', 'libopus', '-b:a', '40k', dest]);
    report.push({ arquivo: job.name, texto: job.en, ouvido: best.heard, wer: Math.round(best.w * 100), tentativas: best.tries });
    console.log(`${n + 1}/${jobs.length} ${job.name} wer=${Math.round(best.w * 100)}% tentativas=${best.tries}`);
  }
  const relPath = path.join(OUT, 'relatorio.json');
  const old = fs.existsSync(relPath) ? JSON.parse(fs.readFileSync(relPath, 'utf8')) : [];
  fs.writeFileSync(relPath, JSON.stringify([...old.filter((o) => !report.some((r) => r.arquivo === o.arquivo)), ...report], null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  app.quit();
});
