const { app, BrowserWindow, shell, ipcMain, safeStorage, net, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const Anthropic = require('@anthropic-ai/sdk').default;
const speech = require('./speech');

const MODEL = 'claude-opus-5-5';
const userFile = (...p) => path.join(app.getPath('userData'), ...p);
let win;

// ---------- API key (criptografada pelo Windows, só neste usuário/PC) ----------
function readKey() {
  try { return safeStorage.decryptString(fs.readFileSync(userFile('api-key.bin'))); } catch { return null; }
}
ipcMain.handle('key:has', () => Boolean(readKey()));
ipcMain.handle('key:set', (_e, key) => { fs.writeFileSync(userFile('api-key.bin'), safeStorage.encryptString(String(key).trim())); return true; });

// ---------- Claude ----------
const str = { type: 'string' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const LEVELS = {
  A1: 'absolute beginner (CEFR A1): very short sentences, present tense, the 500 most common words',
  A2: 'elementary (CEFR A2): simple sentences, basic past and future, the 1500 most common words',
  B1: 'intermediate (CEFR B1): everyday topics, common idioms, natural but clear sentences'
};

const KINDS = {
  chat: ({ scenario, partner, level, messages }) => ({
    effort: 'low',
    system: `You are ${partner}, a friendly native English speaker having a spoken conversation with Davi, a Brazilian learner. His level: ${LEVELS[level]}. His goal: be able to chat with foreigners, understand and be understood.
Scenario: ${scenario}
Latency-sensitive; begin your visible answer immediately.
Rules for "reply":
- Spoken style, 1 to 3 short sentences at his level, then exactly one simple question to keep the talk going.
- Never correct him during the chat (corrections come at the end). React naturally to what he said.
- His messages come from speech-to-text and may contain recognition errors: guess what he meant and continue.
- If he writes in Portuguese, asks how to say something, or seems stuck: put in "try_this" the simple English sentence he could say, and in "reply" encourage him to say it. Otherwise "try_this" is "".
- If he says he did not understand, say it again with simpler words.
"pt": natural Brazilian Portuguese translation of "reply".
"ideas": 2 or 3 short, different things Davi could answer next, at his level, in English.
No emojis, no markdown.`,
    messages: [{ role: 'user', content: '(Start the conversation now with a greeting and a simple question.)' }, ...messages],
    schema: obj({ reply: str, pt: str, ideas: arr(str), try_this: str })
  }),

  review: ({ messages, level }) => ({
    effort: 'medium',
    system: `Você é um professor de inglês paciente de um brasileiro (nível ${level}). Responda em português do Brasil, curto e direto.`,
    messages: [{ role: 'user', content: `Conversa (as falas do Davi vieram de reconhecimento de voz):\n${messages.map((m) => `${m.role === 'user' ? 'Davi' : 'Parceiro'}: ${m.content}`).join('\n')}

Analise só as falas do Davi.
- "resumo": 2 frases honestas e encorajadoras: como ele foi e o foco principal para melhorar.
- "erros": até 5 erros mais importantes (primeiro os que atrapalham ser entendido). "voce_disse" = o que ele disse; "natural" = como um nativo diria, simples; "explicacao" = 1 frase em português. Se ele falou em português, "natural" é como dizer em inglês.
- "pronuncia": palavras que parecem ter sido mal reconhecidas pela máquina (não encaixam no contexto), indicando provável erro de pronúncia. "ouvido" = o que a máquina entendeu; "provavel" = a palavra que ele quis dizer; "dica" = como pronunciar, para brasileiro, em 1 frase. Lista vazia se não houver.` }],
    schema: obj({ resumo: str, erros: arr(obj({ voce_disse: str, natural: str, explicacao: str })), pronuncia: arr(obj({ ouvido: str, provavel: str, dica: str })) })
  }),

  deck: ({ topic, level, existing }) => ({
    effort: 'low',
    system: 'You create flashcards of useful spoken English chunks for a Brazilian learner. Portuguese must be natural Brazilian Portuguese.',
    messages: [{ role: 'user', content: `Create 10 short, very useful phrases a learner at level ${LEVELS[level]} would actually say in conversations about: "${topic}". Prefer whole chunks people really use, not isolated words. Avoid these, already known: ${existing.join(' | ')}` }],
    schema: obj({ frases: arr(obj({ en: str, pt: str })) })
  }),

  episode: ({ topic, level, known }) => ({
    effort: 'medium',
    system: 'You write short listening episodes for a Brazilian English learner. Natural spoken English, comprehensible at his level, with a little new language (i+1). Portuguese must be natural Brazilian Portuguese.',
    messages: [{ role: 'user', content: `Write a natural dialogue between two people (speaker "A" and "B"), 10 to 14 lines, about: "${topic}". Level: ${LEVELS[level]}. Recycle some phrases he knows when natural: ${known.join(' | ') || '(none yet)'}.
"title" in English, "title_pt" in Portuguese. Each line has "pt" translation.
"questions": 3 comprehension questions in Portuguese, each with 3 options in Portuguese and "answer" = index (0-2) of the correct option.
"phrases": the 4 most useful phrases from the dialogue to memorize, with Portuguese.` }],
    schema: obj({ title: str, title_pt: str, lines: arr(obj({ speaker: { type: 'string', enum: ['A', 'B'] }, text: str, pt: str })), questions: arr(obj({ q: str, options: arr(str), answer: { type: 'integer' } })), phrases: arr(obj({ en: str, pt: str })) })
  }),

  why: ({ target, heard, topic }) => ({
    effort: 'low',
    system: 'Você é um coach de pronúncia de inglês para brasileiros. Responda em português do Brasil, em no máximo 2 frases práticas (posição de boca/língua, comparação com sons do português).',
    messages: [{ role: 'user', content: `Frase alvo: "${target}". O reconhecimento de voz entendeu: "${heard}". Tema da semana: ${topic}. Qual o provável erro de pronúncia e como corrigir?` }],
    schema: obj({ dica: str })
  }),

  xray: ({ transcript, seconds, level }) => ({
    effort: 'medium',
    system: 'Você avalia a fala em inglês de um brasileiro. Responda em português do Brasil, honesto e encorajador.',
    messages: [{ role: 'user', content: `Pedimos: "fale por até 90 segundos sobre você: nome, de onde é, trabalho, rotina e do que gosta". Nível declarado: ${level}. Ele falou ${seconds}s e o reconhecimento de voz transcreveu:\n"${transcript}"
- "nivel": estimativa CEFR da fala (ex.: "A1", "A1+", "A2").
- "resumo": 2 frases sobre como ele está.
- "pontos_fortes": até 3.
- "prioridades": as 3 coisas que mais vão fazer ele avançar agora, práticas.
- "versao_melhorada": o que ele disse, reescrito como um nativo diria, simples, em inglês.` }],
    schema: obj({ nivel: str, resumo: str, pontos_fortes: arr(str), prioridades: arr(str), versao_melhorada: str })
  })
};

function friendly(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'API key inválida. Confira em Ajustes.';
  if (e instanceof Anthropic.RateLimitError) return 'Muitas requisições agora. Espere um pouco e tente de novo.';
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com a API do Claude. Verifique a internet.';
  return e.message;
}

ipcMain.handle('ai', async (_e, kind, payload) => {
  const apiKey = readKey();
  if (!apiKey) throw new Error('Cadastre sua API key do Claude em Ajustes.');
  const client = new Anthropic({ apiKey, fetch: (url, init) => net.fetch(url, init) });
  const { effort, system, messages, schema } = KINDS[kind](payload);
  const params = { model: MODEL, max_tokens: 16000, system, messages, output_config: { effort, format: { type: 'json_schema', schema } } };
  let res;
  try {
    try {
      res = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', cache_control: { type: 'ephemeral' } });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      res = await client.messages.create(params); // ponytail: se a API recusar os extras (fallback/cache), vai no básico
    }
  } catch (e) { throw new Error(friendly(e)); }
  if (res.stop_reason === 'refusal') throw new Error('O modelo recusou esse pedido. Tente reformular.');
  if (res.stop_reason === 'max_tokens') throw new Error('A resposta veio cortada. Tente de novo.');
  return JSON.parse(res.content.find((b) => b.type === 'text').text);
});

// ---------- Voz local ----------
ipcMain.handle('speech:ready', () => speech.whenReady().then(() => true, () => false));
ipcMain.handle('speech:transcribe', (_e, pcm, lang) => speech.transcribe(pcm, lang));
ipcMain.handle('speech:speak', (_e, text, voice, speed) => speech.speak(text, voice, speed));
ipcMain.handle('audio:daily', async (_e, cards) => {
  const out = await speech.exportDailyAudio(cards, (p) => win.webContents.send('audio:progress', p));
  shell.showItemInFolder(out);
  return out;
});

// ---------- Gravações do Raio-X ----------
ipcMain.handle('files:save', (_e, name, data) => { fs.mkdirSync(userFile('gravacoes'), { recursive: true }); fs.writeFileSync(userFile('gravacoes', path.basename(name)), Buffer.from(data)); });
ipcMain.handle('files:read', (_e, name) => fs.readFileSync(userFile('gravacoes', path.basename(name))));

// ---------- Lembrete: o Windows abre o app todo dia no horário ----------
ipcMain.handle('reminder:set', (_e, time) => new Promise((resolve) => {
  const args = time
    ? ['/Create', '/F', '/SC', 'DAILY', '/TN', 'TalkReady', '/ST', time, '/TR', `"${process.execPath}" "${app.getAppPath()}"`]
    : ['/Delete', '/F', '/TN', 'TalkReady'];
  execFile('schtasks', args, (e) => resolve(!e));
}));

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    title: 'TalkReady',
    icon: path.join(__dirname, 'talkready.png'),
    backgroundColor: '#0e1014',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // Se a tela travar/cair, recarrega em vez de ficar uma janela morta.
  win.webContents.on('render-process-gone', (_e, d) => { console.error('render-process-gone', d.reason); if (d.reason !== 'clean-exit') win.reload(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  speech.load((p) => win.webContents.send('speech:progress', p)).catch((e) => {
    console.error(e);
    win.webContents.send('speech:progress', -1);
  });
}

// Uma instância só: clicar no atalho de novo traz a janela aberta para a frente (duas instâncias disputam o mesmo perfil e a tela cai).
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

app.whenReady().then(() => {
  if (!firstInstance) return;
  nativeTheme.themeSource = 'dark'; // barra de título escura no Windows
  app.setAppUserModelId('TalkReady'); // barra de tarefas usa o ícone do app, não o do electron.exe
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
