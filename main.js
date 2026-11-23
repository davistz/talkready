const { app, BrowserWindow, shell, ipcMain, safeStorage, net, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const Anthropic = require('@anthropic-ai/sdk').default;
const speech = require('./speech');

const userFile = (...p) => path.join(app.getPath('userData'), ...p);
let win;

// ---------- API key (criptografada pelo Windows, só neste usuário/PC) ----------
function readKey() {
  try { return safeStorage.decryptString(fs.readFileSync(userFile('api-key.bin'))); } catch { return null; }
}
ipcMain.handle('key:has', () => Boolean(readKey()));
ipcMain.handle('key:set', (_e, key) => { fs.writeFileSync(userFile('api-key.bin'), safeStorage.encryptString(String(key).trim())); return true; });

// ---------- Claude ----------
const { request } = require('./prompts');

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
  const params = request(kind, payload);
  let res;
  try {
    try {
      res = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', cache_control: { type: 'ephemeral' } });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      // ponytail: se a API recusar os extras (fallback/cache/effort), vai no básico
      try { res = await client.messages.create(params); } catch (e2) {
        if (!(e2 instanceof Anthropic.BadRequestError)) throw e2;
        res = await client.messages.create(request(kind, payload, { withEffort: false }));
      }
    }
  } catch (e) { throw new Error(friendly(e)); }
  if (res.stop_reason === 'refusal') throw new Error('O modelo recusou esse pedido. Tente reformular.');
  if (res.stop_reason === 'max_tokens') throw new Error('A resposta veio cortada. Tente de novo.');
  return JSON.parse(res.content.find((b) => b.type === 'text').text);
});

// ---------- Voz local ----------
ipcMain.handle('speech:ready', () => speech.whenReady().then(() => true, () => false));
ipcMain.handle('speech:transcribe', (_e, pcm, lang) => speech.transcribe(pcm, lang));
ipcMain.handle('speech:assess', (_e, pcm, target) => speech.assess(pcm, target));
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
