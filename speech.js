// Voz local (sem custo, offline depois do 1º download): Whisper para ouvir você, Kokoro para falar inglês natural.
const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');

// transformers.js baixa os modelos com fetch global; o net.fetch do Electron confia nos certificados do Windows.
globalThis.fetch = (url, init) => net.fetch(url, init);

const MODELS_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'TalkReady', 'models');
let asr, tts, ready;
const files = {};

// ponytail: uma inferência por vez (ASR e TTS dividem a CPU); fila por promessa basta.
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));

function load(onProgress) {
  ready ||= (async () => {
    const progress_callback = (p) => {
      if (p.status !== 'progress') return;
      files[p.file] = [p.loaded, p.total];
      const [l, t] = Object.values(files).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
      onProgress(Math.round(l / t * 100));
    };
    const { env, pipeline } = require('@huggingface/transformers');
    env.cacheDir = MODELS_DIR;
    const { KokoroTTS } = require('kokoro-js');
    [asr, tts] = await Promise.all([
      pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', { dtype: 'q8', device: 'cpu', progress_callback }),
      KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu', progress_callback })
    ]);
    onProgress(100);
  })();
  return ready;
}

async function transcribe(pcm16k, language = 'english') {
  await ready;
  return serial(async () => (await asr(pcm16k, { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })).text.trim());
}

// Confiança em cada palavra da frase alvo (detalhes em whisper-score.js).
async function assess(pcm16k, target) {
  await ready;
  const { Tensor } = require('@huggingface/transformers');
  return serial(() => require('./whisper-score').assess({ model: asr.model, processor: asr.processor, tokenizer: asr.tokenizer, Tensor }, pcm16k, target));
}

const RATE = 24000; // saída do Kokoro
const toInt16 = (f32) => Int16Array.from(f32, (x) => Math.max(-1, Math.min(1, x)) * 32767);
const synth = async (text, voice, speed) => { await ready; return serial(async () => toInt16((await tts.generate(text, { voice, speed })).audio)); };

// Devolve um WAV pronto para o <audio> do app.
async function speak(text, voice = 'af_heart', speed = 1) {
  const pcm = await synth(text, voice, speed);
  return Buffer.concat([wavHeader(pcm.length), Buffer.from(pcm.buffer)]);
}

// ---------- Áudio do carro (estilo Pimsleur): português → pausa → inglês → inglês devagar ----------
const silence = (s) => new Int16Array(Math.round(s * RATE));

function wavHeader(samples) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
  return b;
}

function readWavPcm(file) {
  const b = fs.readFileSync(file);
  for (let i = 12; i < b.length - 8;) {
    const id = b.toString('ascii', i, i + 4), size = b.readUInt32LE(i + 4);
    if (id === 'data') return new Int16Array(b.buffer.slice(b.byteOffset + i + 8, b.byteOffset + i + 8 + size));
    i += 8 + size + (size % 2);
  }
  return new Int16Array(0);
}

// Voz pt-BR do Windows (SAPI) para os enunciados em português; o Kokoro só fala inglês.
function sapiPortuguese(texts, dir) {
  fs.writeFileSync(path.join(dir, 'pt.json'), JSON.stringify(texts), 'utf8');
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
$s.Rate = -1
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$texts = Get-Content -Raw -Encoding UTF8 '${path.join(dir, 'pt.json')}' | ConvertFrom-Json
$texts = @($texts)
for ($i = 0; $i -lt $texts.Count; $i++) { $s.SetOutputToWaveFile((Join-Path '${dir}' "pt_$i.wav"), $fmt); $s.Speak($texts[$i]) }
$s.Dispose()`;
  return new Promise((res, rej) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], (e) => e ? rej(e) : res()));
}

async function exportDailyAudio(cards, onProgress) {
  await ready;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talkready-'));
  await sapiPortuguese(cards.map((c) => c.pt), dir);
  const parts = [silence(1)];
  for (let i = 0; i < cards.length; i++) {
    const normal = await synth(cards[i].en, 'af_heart', 1), slow = await synth(cards[i].en, 'am_michael', 0.8);
    parts.push(readWavPcm(path.join(dir, `pt_${i}.wav`)), silence(3), normal, silence(1.5), slow, silence(2.5));
    onProgress(Math.round((i + 1) / cards.length * 100));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const total = parts.reduce((a, p) => a + p.length, 0);
  const outDir = path.join(process.env.OneDriveCommercial || process.env.OneDrive || app.getPath('documents'), 'TalkReady - Áudios');
  fs.mkdirSync(outDir, { recursive: true });
  const d = new Date(), name = `talkready-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.wav`;
  const out = path.join(outDir, name);
  fs.writeFileSync(out, Buffer.concat([wavHeader(total), ...parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength))]));
  return out;
}

module.exports = { load, whenReady: () => ready, transcribe, assess, speak, exportDailyAudio };
