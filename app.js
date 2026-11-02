const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const errMsg = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

const BLOCKS = [
  { id: 'revisar', title: 'Frases', desc: 'Dizer em inglês, revisão espaçada', weight: 0.2 },
  { id: 'pronuncia', title: 'Pronúncia', desc: 'Som da semana, pares e shadowing', weight: 0.25 },
  { id: 'ouvir', title: 'Ouvir', desc: 'Episódio do seu nível ou vídeo', weight: 0.25 },
  { id: 'conversar', title: 'Conversar', desc: 'Papo por voz + correção', weight: 0.3 }
];
const PHASES = [
  { until: 4, label: 'SEMANAS 1–4 · BASE', title: 'Destravar o básico', text: 'Kit de sobrevivência ("can you say that again?") e os sons que mais atrapalham. Meta: falar 1 minuto sobre você sem travar.' },
  { until: 8, label: 'SEMANAS 5–8 · SEU MUNDO', title: 'Falar da sua vida', text: 'Trabalho, rotina, gostos, Brasil. Meta: explicar o que você faz por 2 minutos. Primeira conversa com um gringo de verdade (missão da semana 7).' },
  { until: 12, label: 'SEMANAS 9–12 · CONVERSA REAL', title: 'Conversar com gringo', text: 'Mais conversa, menos frase solta. Meta do dia 90: 15 minutos de papo com um estrangeiro, entendendo e se fazendo entender. Raio-X final.' }
];
const KIT = ['Sorry, can you say that again?', 'Can you speak more slowly, please?', 'What does that mean?', 'How do you say "" in English?', 'Let me think...'];

// ---------- estado ----------
const fresh = () => ({ v: 3, start: dayKey(), level: 'A1', goals: { weekday: 60, weekend: 60 }, newPerDay: 10, days: {}, cards: [], introduced: {}, convs: 0, missions: {}, pron: {}, quiz: { ok: 0, n: 0 }, xrays: [], soundPick: null, reminder: null, modules: {} });
let state;
try { state = { ...fresh(), ...JSON.parse(localStorage.getItem('talkready-v3')) }; } catch { state = fresh(); }
if (!state.cards.length) state.cards = STARTER_DECK.map(([en, pt, tag], i) => newCard(i + 1, en, pt, tag));
function newCard(id, en, pt, tag) { return { id, en, pt, tag, due: 0, ivl: 0, ease: 2.5, reps: 0, isNew: true }; }
const save = () => localStorage.setItem('talkready-v3', JSON.stringify(state));

const today = () => (state.days[dayKey()] ||= {});
const dayMinutes = (k) => Object.values(state.days[k] || {}).reduce((a, b) => a + b, 0) / 60;
const isWeekend = () => [0, 6].includes(new Date().getDay());
const dailyGoal = () => isWeekend() ? state.goals.weekend : state.goals.weekday;
const goalOf = (b) => Math.max(3, Math.round(dailyGoal() * b.weight));
const weekNumber = () => Math.floor((new Date(dayKey()) - new Date(state.start)) / (7 * DAY)) + 1;
const weekSound = () => (weekNumber() - 1) % SOUNDS.length;

function streak() {
  let n = 0; const d = new Date();
  if (dayMinutes(dayKey(d)) < 15) d.setDate(d.getDate() - 1); // hoje ainda está em aberto
  while (dayMinutes(dayKey(d)) >= 15) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }

// ---------- voz que fala (Kokoro local; cai para a voz do Windows se não carregar) ----------
let speechState = 'loading';
api.onSpeechProgress((p) => {
  if (p >= 0 && p < 100) $('#voiceStatus').textContent = `🎙 Baixando voz natural… ${p}%`;
});
api.speechReady().then((ok) => {
  speechState = ok ? 'ready' : 'error';
  $('#voiceStatus').textContent = ok ? '🎙 Voz pronta' : '🎙 Voz local indisponível';
  $('#voiceStatus').classList.toggle('ok', ok);
});

const audioCache = new Map();
let playToken = 0, currentAudio = null;
const sentences = (t) => (t.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [t]).map((s) => s.trim()).filter(Boolean);
function ttsUrl(text, voice) {
  const key = `${voice}|${text}`;
  if (!audioCache.has(key)) {
    audioCache.set(key, api.speak(text, voice, 1)
      .then((wav) => URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })))
      .catch((e) => { audioCache.delete(key); throw e; }));
  }
  return audioCache.get(key);
}
const prefetch = (text, voice) => speechState === 'ready' && sentences(text).forEach((s) => ttsUrl(s, voice).catch(() => {}));
function playUrl(url, rate) {
  return new Promise((res) => {
    const a = currentAudio = new Audio(url);
    a.playbackRate = rate; a.onended = a.onerror = a.onpause = res;
    a.play().catch(res);
  });
}
let epRun = 0; // sequência do episódio em andamento; qualquer outro áudio pedido pelo usuário a interrompe
function interrupt() { playToken++; currentAudio?.pause(); currentAudio = null; speechSynthesis.cancel(); }
function stopAudio() { epRun++; interrupt(); }
const say = (text, opts) => { epRun++; return speakNow(text, opts); };
async function speakNow(text, { voice = 'af_heart', rate = 1 } = {}) {
  interrupt(); const token = playToken;
  if (speechState === 'ready') {
    try {
      const urls = sentences(text).map((s) => ttsUrl(s, voice)); // o main gera em fila; tocamos assim que cada uma fica pronta
      urls.forEach((u) => u.catch(() => {}));
      for (const u of urls) { const url = await u; if (token !== playToken) return; await playUrl(url, rate); if (token !== playToken) return; }
      return;
    } catch { /* cai para a voz do Windows */ }
  }
  return new Promise((res) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = rate * 0.9; u.voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-US') || null;
    u.onend = u.onerror = res; speechSynthesis.speak(u);
  });
}

// Áudio pré-gravado (módulos, VoiceStudio); se o arquivo não existir, fala com a voz local.
function playFile(src, text, { voice = 'af_heart', rate = 1 } = {}) {
  interrupt();
  return new Promise((res) => {
    const a = currentAudio = new Audio(src);
    a.playbackRate = rate; a.onended = a.onpause = res;
    a.onerror = () => { if (currentAudio === a) res(speakNow(text, { voice, rate })); else res(); };
    a.play().catch(() => {});
  });
}

// ---------- voz que ouve (Whisper local) ----------
let rec = null;
async function startRec(btn) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mr = new MediaRecorder(stream), chunks = [];
  mr.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => { mr.onstop = r; });
  mr.start();
  rec = { mr, stream, chunks, done, btn };
}
async function stopRec() {
  const { mr, stream, chunks, done } = rec; rec = null;
  mr.stop(); await done; stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(chunks, { type: mr.mimeType });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer()); ctx.close();
  const pcm = buf.getChannelData(0);
  let sum = 0; for (const x of pcm) sum += x * x;
  return { pcm, blob, seconds: buf.duration, rms: Math.sqrt(sum / pcm.length) };
}
function cancelRec() {
  if (!rec) return;
  rec.mr.stop(); rec.stream.getTracks().forEach((t) => t.stop()); rec.btn.classList.remove('rec'); rec = null;
}
// Liga/desliga a gravação no botão; ao parar, transcreve e chama onText(texto, gravação).
async function micToggle(btn, onText, lang = 'english') {
  btn.blur();
  if (rec && !rec.btn.isConnected) cancelRec(); // o botão que gravava sumiu da tela (re-render)
  if (rec) {
    if (rec.btn !== btn) return;
    btn.classList.remove('rec'); btn.classList.add('busy');
    try {
      const r = await stopRec();
      if (r.seconds < 0.4 || r.rms < 0.003) return toast('Não ouvi nada. Fale mais perto do microfone.');
      if (speechState === 'loading') toast('Carregando o reconhecimento de voz, só um instante…');
      const text = await api.transcribe(r.pcm, lang);
      if (!text) return toast('Não entendi nada. Tente de novo, mais devagar.');
      await onText(text, r);
    } catch (e) { toast(errMsg(e)); } finally { btn.classList.remove('busy'); }
    return;
  }
  if (speechState === 'error') return toast('O reconhecimento de voz não carregou. Reinicie o app; na conversa dá para digitar.');
  stopAudio();
  try { await startRec(btn); btn.classList.add('rec'); } catch { toast('Não consegui usar o microfone. Veja Configurações do Windows > Privacidade > Microfone.'); }
}
const playBlob = (blob) => { stopAudio(); return playUrl(URL.createObjectURL(blob), 1); };

const scoreClass = (s) => s >= 90 ? 'ok' : s >= 60 ? 'mid' : 'bad';
const resultHtml = (r, heard) => `<b class="${scoreClass(r.score)}">${r.score}%</b> ${r.words.map(([w, ok]) => `<span class="${ok ? 'w-ok' : 'w-bad'}">${esc(w)}</span>`).join(' ')}<br><small class="muted">A máquina ouviu: “${esc(heard)}”</small>`;

// ---------- teclado ----------
document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (typing || $('#settings').classList.contains('open')) return;
  if (e.code === 'Space' && !e.repeat) {
    const m = [...document.querySelectorAll('.page-section.active-section .mic.primary')].find((x) => x.offsetParent);
    if (m) { e.preventDefault(); document.activeElement.blur(); m.click(); }
  }
  if (current === 'revisar') {
    if (e.key === 'Enter' && !flipped && queue[0]) { e.preventDefault(); flipped = true; renderSrs(); }
    if (flipped && '1234'.includes(e.key) && queue[0]) grade(queue[0], +e.key - 1);
  }
});

// ---------- navegação e tempo ----------
let current = 'hoje', listening = false;
function show(id) {
  current = id; stopAudio(); cancelRec();
  document.querySelectorAll('.page-section').forEach((s) => s.classList.toggle('active-section', s.id === id));
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.section === id));
  ({ hoje: renderHoje, modulos: renderModulos, revisar: renderSrs, pronuncia: renderSound, conversar: renderConversar, ouvir: renderOuvir, progresso: renderProgresso })[id]();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => show(b.dataset.section)));
const nextBlock = () => BLOCKS.find((b) => (today()[b.id] || 0) < goalOf(b) * 60);

// Conta 1 s para o bloco aberto enquanto a janela está em foco; o timer de "Ouvir" conta mesmo fora do app.
setInterval(() => {
  const sec = current === 'modulos' ? 'ouvir' : current; // módulo é treino de ouvido + repetição
  const block = listening ? 'ouvir' : (document.hasFocus() && BLOCKS.some((b) => b.id === sec) ? sec : null);
  const chip = $('#timerChip');
  if (!block) { chip.hidden = true; return; }
  const t = today(), b = BLOCKS.find((x) => x.id === block);
  t[block] = (t[block] || 0) + 1;
  if (t[block] % 10 === 0) save();
  const done = t[block] >= goalOf(b) * 60, nb = nextBlock();
  chip.hidden = false;
  chip.classList.toggle('done', done);
  chip.textContent = done && nb ? `✓ ${b.title} feito · Próximo: ${nb.title} →` : `⏱ ${b.title}: ${Math.floor(t[block] / 60)}/${goalOf(b)} min`;
  if (t[block] === goalOf(b) * 60) toast(nb ? `Meta de ${b.title} batida! Próximo: ${nb.title}.` : 'Treino do dia completo! 🎉');
  if (block === 'ouvir') $('#listenClock').textContent = clock(t.ouvir);
}, 1000);
$('#timerChip').onclick = () => { const nb = nextBlock(); if (nb && $('#timerChip').classList.contains('done')) show(nb.id); };
window.addEventListener('beforeunload', save);
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- HOJE ----------
async function renderHoje() {
  const goal = dailyGoal(), done = Math.floor(dayMinutes(dayKey())), t = today();
  $('#todayLabel').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase();
  $('#todayLead').textContent = `${isWeekend() ? 'Fim de semana' : 'Dia útil'}: ${goal} minutos. Siga os blocos na ordem.`;
  $('#todayMin').textContent = done; $('#todayGoal').textContent = goal;
  $('#todayBar').style.width = `${Math.min(100, done / goal * 100)}%`;
  $('#blockGrid').innerHTML = BLOCKS.map((b, i) => {
    const m = Math.floor((t[b.id] || 0) / 60), g = goalOf(b), ok = m >= g;
    return `<button class="block-card ${ok ? 'done' : ''}" data-go="${b.id}"><span class="block-n">${ok ? '✓' : i + 1}</span><span><strong>${b.title}</strong><small>${b.desc}</small></span><span class="block-min">${m}/${g} min</span><span class="bar"><span style="width:${Math.min(100, m / g * 100)}%"></span></span></button>`;
  }).join('');
  document.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => show(b.dataset.go); });
  const nb = nextBlock();
  $('#guided').textContent = nb ? (done ? `▶ Continuar: ${nb.title}` : '▶ Começar treino guiado') : '✓ Treino de hoje completo. Quer mais? Converse!';
  $('#guided').onclick = () => show(nb ? nb.id : 'conversar');
  const wm = MODULES[(weekNumber() - 1) % MODULES.length];
  $('#moduleCta').innerHTML = `<span class="eyebrow">MÓDULO DA SEMANA ${state.modules[wm.id] ? '· CONCLUÍDO ✓' : ''}</span><strong>${wm.id}. ${esc(wm.title)}</strong><small>${esc(wm.goal)}</small><span class="go">Abrir →</span>`;
  $('#moduleCta').onclick = () => { openModule = wm.id; show('modulos'); };

  const w = weekNumber(), wk = ((w - 1) % 12) + 1, p = PHASES.find((x) => wk <= x.until);
  $('#phaseLabel').textContent = `CICLO ${Math.floor((w - 1) / 12) + 1} · SEMANA ${wk} DE 12 · ${p.label}`;
  $('#phaseTitle').textContent = p.title; $('#phaseText').textContent = p.text;
  $('#missionLabel').textContent = `MISSÃO DA SEMANA ${wk}`;
  $('#missionText').textContent = MISSIONS[wk - 1];
  $('#missionDone').checked = Boolean(state.missions[w]);
  $('#missionDone').onchange = (e) => { state.missions[w] = e.target.checked; save(); if (e.target.checked) toast('Missão cumprida! 💪'); };
  $('#streakCount').textContent = streak();

  const hasKey = await api.hasKey(), lastX = state.xrays.at(-1);
  const steps = [
    !hasKey && '<li><b>Cadastre sua API key</b> do Claude em <a href="#" data-open-settings>Ajustes</a> (conversa e correções).</li>',
    !lastX && '<li><b>Faça o Raio-X do dia 1</b> em <a href="#" data-goto="progresso">Progresso</a>: 90 segundos falando. É o seu "antes".</li>',
    lastX && Date.now() - new Date(lastX.date) > 30 * DAY && '<li><b>Hora do Raio-X do mês</b> em <a href="#" data-goto="progresso">Progresso</a>. Compare com o anterior.</li>'
  ].filter(Boolean);
  $('#setupCard').hidden = !steps.length;
  $('#setupCard').innerHTML = `<p class="eyebrow">COMECE AQUI</p><ol>${steps.join('')}</ol>`;
  $('#setupCard').querySelectorAll('[data-goto]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); show(a.dataset.goto); }; });
  $('#setupCard').querySelectorAll('[data-open-settings]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); openSettings(); }; });
}

$('#dailyAudio').onclick = async () => {
  const learned = state.cards.filter((c) => !c.isNew).sort((a, b) => a.due - b.due).slice(0, 40);
  if (!learned.length) return toast('Revise algumas frases primeiro: o áudio usa as frases que você já viu.');
  if (speechState !== 'ready') return toast('A voz natural ainda está carregando. Tente em instantes.');
  const btn = $('#dailyAudio'); btn.disabled = true;
  const off = (p) => { btn.textContent = `Gerando… ${p}%`; };
  api.onAudioProgress(off); off(0);
  try { await api.dailyAudio(learned.map(({ en, pt }) => ({ en, pt }))); toast(`Áudio com ${learned.length} frases salvo no OneDrive (pasta "TalkReady - Áudios").`); } catch (e) { toast(errMsg(e)); }
  btn.disabled = false; btn.textContent = 'Gerar áudio de hoje';
};

// ---------- FRASES (SRS, SM-2 simplificado, falado) ----------
let queue = [], flipped = false, srsHeard = null;
function buildQueue() {
  const now = Date.now();
  const due = state.cards.filter((c) => !c.isNew && c.due <= now).sort((a, b) => a.due - b.due);
  const left = Math.max(0, state.newPerDay - (state.introduced[dayKey()] || 0));
  queue = [...due, ...state.cards.filter((c) => c.isNew).slice(0, left)];
}
function renderSrs() {
  if (!queue.length) buildQueue();
  const c = queue[0], el = $('#srsCard');
  const dueTomorrow = state.cards.filter((x) => !x.isNew && x.due <= Date.now() + DAY).length;
  $('#srsStats').textContent = `${state.cards.filter((x) => !x.isNew).length} frases aprendidas · ${state.cards.filter((x) => x.isNew).length} novas esperando · Espaço = falar · Enter = mostrar · 1–4 = nota`;
  if (!c) { el.innerHTML = `<div class="srs-empty"><strong>Tudo revisado por hoje ✓</strong><p class="muted">Amanhã: ~${dueTomorrow} frases. Sobrou tempo? Gere frases sobre um assunto seu ou vá para a Pronúncia.</p></div>`; return; }
  if (!flipped) prefetch(c.en, 'af_heart');
  let suggested = -1;
  if (srsHeard) { const s = srsHeard.r.score; suggested = s >= 90 ? 2 : s >= 60 ? 1 : 0; }
  el.innerHTML = `
    <p class="eyebrow">${c.isNew ? 'NOVA' : 'REVISÃO'} · ${esc(c.tag)} · faltam ${queue.length}</p>
    <p class="srs-pt">${esc(c.pt)}</p>
    ${flipped ? `
      <p class="srs-en">${esc(c.en)}</p>
      ${srsHeard ? `<p class="result">${resultHtml(srsHeard.r, srsHeard.text)}</p>` : ''}
      <div class="row center"><button class="round-button" id="srsPlay" title="Ouvir">▶</button><button class="outline-button" id="srsSlow">🐢 Devagar</button>${srsHeard ? '<button class="outline-button" id="srsMe">▶ Você</button>' : ''}</div>
      <div class="grades">${['Errei', 'Difícil', 'Bom', 'Fácil'].map((g, i) => `<button data-g="${i}" class="g${i} ${i === suggested ? 'suggested' : ''}">${g}<small>${['volta hoje', 'pouco tempo', 'normal', 'bem depois'][i]}</small></button>`).join('')}</div>`
    : `<div class="row center"><button class="mic primary big" id="srsMic">🎤 Falar</button><button class="outline-button" id="srsFlip">Mostrar resposta</button></div>`}`;
  if (flipped) {
    say(c.en);
    $('#srsPlay').onclick = () => say(c.en); $('#srsSlow').onclick = () => say(c.en, { rate: 0.75 });
    if (srsHeard) $('#srsMe').onclick = () => playBlob(srsHeard.blob);
    el.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => grade(c, +b.dataset.g); });
  } else {
    $('#srsFlip').onclick = () => { flipped = true; renderSrs(); };
    $('#srsMic').onclick = () => micToggle($('#srsMic'), (text, r) => { srsHeard = { text, r: compareWords(c.en, text), blob: r.blob }; flipped = true; renderSrs(); });
  }
}
function grade(c, g) {
  if (c.isNew) { c.isNew = false; state.introduced[dayKey()] = (state.introduced[dayKey()] || 0) + 1; }
  queue.shift(); flipped = false; srsHeard = null;
  Object.assign(c, schedule(c, g, Date.now(), new Date().setHours(0, 0, 0, 0)));
  if (g === 0) queue.push(c); else c.reps++; // "Errei" volta no fim da fila de hoje
  save(); renderSrs();
}
// Frases pessoais (erros, assuntos seus, episódios) passam na frente das frases genéricas ainda não vistas.
function addCards(list, tag) {
  let id = Math.max(0, ...state.cards.map((c) => c.id));
  const known = new Set(state.cards.map((c) => c.en.toLowerCase()));
  const add = list.filter((x) => x.en && !known.has(x.en.toLowerCase())).map((x) => newCard(++id, x.en, x.pt, tag));
  const at = state.cards.findIndex((c) => c.isNew);
  state.cards.splice(at < 0 ? state.cards.length : at, 0, ...add);
  queue = []; flipped = false; srsHeard = null; save();
  return add.length;
}
$('#addCard').onclick = () => {
  const en = $('#newEn').value.trim(), pt = $('#newPt').value.trim();
  if (!en || !pt) return toast('Preencha inglês e português.');
  addCards([{ en, pt }], 'Minhas'); $('#newEn').value = ''; $('#newPt').value = ''; toast('Frase adicionada.'); renderSrs();
};
$('#genDeck').onclick = async () => {
  const topic = $('#deckTopic').value.trim(); if (!topic) return toast('Escreva um assunto.');
  const btn = $('#genDeck'); btn.disabled = true; btn.textContent = 'Gerando…';
  try {
    const { frases } = await api.ai('deck', { topic, level: state.level, existing: state.cards.slice(-150).map((c) => c.en) });
    const n = addCards(frases, topic.slice(0, 20));
    toast(`${n} frases sobre "${topic}" entram nas próximas revisões.`); $('#deckTopic').value = ''; renderSrs();
  } catch (e) { toast(errMsg(e)); }
  btn.disabled = false; btn.textContent = 'Gerar 10';
};

// ---------- cartão de frase reutilizável (ouvir, devagar, gravar, comparar, por quê) ----------
const PH = [];
function phraseCard(text, { voice = 'af_heart', pt = '', label = '', topic = '', src = '' } = {}) {
  const i = PH.push({ text, voice, topic, src }) - 1;
  return `<div class="card phrase" data-ph="${i}">
    <div class="row">${label ? `<span class="speaker">${esc(label)}</span>` : ''}<p class="ph-text">${esc(text)}</p>
      <button class="round-button" data-act="play" title="Ouvir">▶</button><button class="outline-button" data-act="slow" title="Devagar">🐢</button><button class="mic" data-act="rec" title="Gravar">🎤</button></div>
    ${pt ? `<p class="ph-pt muted" hidden>${esc(pt)}</p>` : ''}
    <div class="ph-result"></div></div>`;
}
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const card = btn.closest('[data-ph]'), p = PH[card.dataset.ph], res = card.querySelector('.ph-result');
  const act = btn.dataset.act;
  if (act === 'play' || act === 'slow') {
    const rate = act === 'slow' ? 0.75 : 1;
    if (p.src) { stopAudio(); playFile(p.src, p.text, { voice: p.voice, rate }); } else say(p.text, { voice: p.voice, rate });
  }
  if (act === 'pt') card.querySelector('.ph-pt').hidden = false;
  if (act === 'me') playBlob(p.blob);
  if (act === 'rec') {
    micToggle(btn, (heard, r) => {
      p.blob = r.blob; p.heard = heard;
      const cmp = compareWords(p.text, heard);
      res.innerHTML = `<p class="result">${resultHtml(cmp, heard)}</p><div class="row"><button class="outline-button" data-act="me">▶ Você</button><button class="outline-button" data-act="play">▶ Original</button>${cmp.score < 100 ? '<button class="outline-button" data-act="why">🤔 Por que errei?</button>' : '<span class="ok">Perfeito! 🎯</span>'}</div><p class="why muted"></p>`;
    });
  }
  if (act === 'why') {
    btn.disabled = true; btn.textContent = 'Pensando…';
    try { const { dica } = await api.ai('why', { target: p.text, heard: p.heard, topic: p.topic || 'pronúncia geral' }); res.querySelector('.why').textContent = `💡 ${dica}`; btn.remove(); } catch (err) { toast(errMsg(err)); btn.disabled = false; btn.textContent = '🤔 Por que errei?'; }
  }
});

// ---------- PRONÚNCIA ----------
let pairTarget = null;
function renderSound() {
  const idx = state.soundPick ?? weekSound(), s = SOUNDS[idx];
  $('#soundEyebrow').textContent = idx === weekSound() ? 'SOM DA SEMANA' : 'TREINO EXTRA';
  $('#soundTitle').innerHTML = `${esc(s.title)}<span>.</span>`;
  $('#soundTip').textContent = s.tip;
  $('#soundChips').innerHTML = SOUNDS.map((x, i) => `<button class="chip ${i === idx ? 'active' : ''}" data-s="${i}">${i === weekSound() ? '★ ' : ''}${esc(x.title)}${state.pron[i] ? ` · ${Math.round(state.pron[i].ok / state.pron[i].n * 100)}%` : ''}</button>`).join('');
  document.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { state.soundPick = +b.dataset.s === weekSound() ? null : +b.dataset.s; save(); renderSound(); }; });
  $('#soundPhrases').innerHTML = `<p class="eyebrow">FRASES PARA SHADOWING</p>` + s.phrases.map((p) => phraseCard(p, { topic: s.title })).join('');
  $('#pairsCard').hidden = !s.pairs;
  if (s.pairs) newPair(idx);
}
function newPair(idx) {
  const s = SOUNDS[idx], pair = pick(s.pairs), side = Math.random() < 0.5 ? 0 : 1;
  pairTarget = { word: pair[side], other: pair[1 - side], idx };
  const st = state.pron[idx];
  $('#pairsCard').innerHTML = `
    <p class="eyebrow">PARES MÍNIMOS · troque o som e a palavra muda${st ? ` · você acertou ${st.ok} de ${st.n}` : ''}</p>
    <div class="pair-list">${s.pairs.map(([a, b]) => `<span class="pair"><button data-word="${a}">${a}</button><i>×</i><button data-word="${b}">${b}</button></span>`).join('')}</div>
    <div class="drill"><span class="muted">Diga:</span><strong>${pairTarget.word}</strong><button class="mic primary big" id="pairMic">🎤</button><button class="outline-button" id="pairNext">Outra →</button></div>
    <p class="result center" id="pairResult">Clique numa palavra para ouvir. Depois grave a palavra pedida.</p>`;
  $('#pairsCard').querySelectorAll('[data-word]').forEach((b) => { b.onclick = () => say(b.dataset.word); });
  $('#pairNext').onclick = () => newPair(idx);
  $('#pairMic').onclick = () => micToggle($('#pairMic'), (heard) => {
    const w = norm(heard), ok = w.includes(pairTarget.word);
    const st = state.pron[idx] ||= { ok: 0, n: 0 }; st.n++; if (ok) st.ok++; save();
    $('#pairResult').innerHTML = ok ? `<b class="ok">✓ Entendeu “${esc(pairTarget.word)}”!</b>`
      : w.includes(pairTarget.other) ? `<b class="bad">✗ Ouvi “${esc(pairTarget.other)}”.</b> O som saiu trocado: ouça os dois e tente de novo.`
      : `<b class="mid">Ouvi “${esc(heard)}”.</b> Fale só a palavra, claro e sem pressa.`;
    if (ok) setTimeout(() => current === 'pronuncia' && newPair(idx), 1400);
  });
}

// ---------- CONVERSAR ----------
let chat = null;
async function renderConversar() {
  $('#keyCard').hidden = await api.hasKey();
  if (chat) return;
  $('#chat').hidden = true;
  $('#scenarioGrid').hidden = false;
  $('#scenarioGrid').innerHTML = SCENARIOS.map((s) => `<button class="scenario-card" data-sc="${s.id}"><strong>${esc(s.title)}</strong><small>${esc(s.desc)}</small><span class="partner">com ${esc(s.partner)} · sotaque ${s.voice.startsWith('b') ? 'britânico' : 'americano'}</span></button>`).join('');
  document.querySelectorAll('[data-sc]').forEach((b) => { b.onclick = () => startChat(SCENARIOS.find((s) => s.id === b.dataset.sc)); });
}
$('#saveKey').onclick = async () => {
  const k = $('#keyInput').value.trim(); if (!k) return;
  await api.setKey(k); $('#keyInput').value = ''; toast('API key salva.'); renderConversar();
};
function renderChat() {
  const last = chat.turns.findLastIndex((t) => t.role === 'assistant');
  $('#chatLog').innerHTML = chat.turns.map((t, i) => t.role === 'user'
    ? `<div class="msg user">${esc(t.text)}${t.lang === 'portuguese' ? ' <small>(PT)</small>' : ''}</div>`
    : `<div class="msg assistant">
        <div class="msg-text ${$('#hideText').checked && !t.shown ? 'blur' : ''}" data-reveal="${i}" title="Clique para ver o texto">${esc(t.reply)}</div>
        ${t.showPt ? `<div class="msg-pt">${esc(t.pt)}</div>` : ''}
        <div class="msg-tools"><button data-say="${i}">▶</button><button data-slow="${i}">🐢</button><button data-pt="${i}">PT</button>${i === last && t.ideas?.length ? `<button data-ideas="${i}">💡 ideias</button>` : ''}</div>
        ${t.try_this ? `<div class="try">Tente dizer: <b>${esc(t.try_this)}</b> <button data-try="${i}">▶</button></div>` : ''}
        ${i === last && t.showIdeas ? `<div class="ideas">${t.ideas.map((x) => `<button data-idea="${esc(x)}">${esc(x)}</button>`).join('')}<small class="muted">Ouça e diga com a sua voz.</small></div>` : ''}
      </div>`).join('') + (chat.busy ? `<div class="msg assistant typing">${esc(chat.sc.partner)} está pensando…</div>` : '');
  const log = $('#chatLog');
  log.querySelectorAll('[data-reveal]').forEach((b) => { b.onclick = () => { chat.turns[b.dataset.reveal].shown = true; renderChat(); }; });
  log.querySelectorAll('[data-say]').forEach((b) => { b.onclick = () => say(chat.turns[b.dataset.say].reply, { voice: chat.sc.voice }); });
  log.querySelectorAll('[data-slow]').forEach((b) => { b.onclick = () => say(chat.turns[b.dataset.slow].reply, { voice: chat.sc.voice, rate: 0.75 }); });
  log.querySelectorAll('[data-pt]').forEach((b) => { b.onclick = () => { const t = chat.turns[b.dataset.pt]; t.showPt = !t.showPt; t.shown = true; renderChat(); }; });
  log.querySelectorAll('[data-ideas]').forEach((b) => { b.onclick = () => { const t = chat.turns[b.dataset.ideas]; t.showIdeas = !t.showIdeas; renderChat(); }; });
  log.querySelectorAll('[data-try]').forEach((b) => { b.onclick = () => say(chat.turns[b.dataset.try].try_this, { voice: 'am_michael' }); });
  log.querySelectorAll('[data-idea]').forEach((b) => { b.onclick = () => say(b.dataset.idea, { voice: 'am_michael' }); });
  log.scrollTop = log.scrollHeight;
}
$('#hideText').onchange = () => chat && renderChat();
async function aiTurn() {
  chat.busy = true; renderChat();
  try {
    const r = await api.ai('chat', { scenario: chat.sc.prompt, partner: chat.sc.partner, level: state.level, messages: chat.messages });
    chat.messages.push({ role: 'assistant', content: r.reply });
    chat.turns.push({ role: 'assistant', ...r });
    chat.busy = false; renderChat();
    say(r.reply, { voice: chat.sc.voice });
  } catch (e) { chat.busy = false; renderChat(); toast(errMsg(e)); }
}
async function startChat(sc) {
  if (!(await api.hasKey())) return toast('Cadastre a API key primeiro.');
  chat = { sc, messages: [], turns: [] };
  $('#scenarioGrid').hidden = true; $('#review').hidden = true; $('#chat').hidden = false;
  $('#chatTitle').textContent = `${sc.title} · com ${sc.partner}`;
  $('#kitRow').innerHTML = KIT.map((k) => `<button data-kit="${esc(k)}">${esc(k)}</button>`).join('');
  $('#kitRow').querySelectorAll('[data-kit]').forEach((b) => { b.onclick = () => kit(b.dataset.kit); });
  await aiTurn();
}
function kit(phrase) {
  if (phrase.includes('""')) { const at = phrase.indexOf('""') + 1; $('#chatInput').value = phrase; $('#chatInput').focus(); $('#chatInput').setSelectionRange(at, at); return; }
  say(phrase, { voice: 'am_michael' }); send(phrase);
}
async function send(text, lang = 'english') {
  if (!text || !chat || chat.busy) return;
  chat.messages.push({ role: 'user', content: lang === 'portuguese' ? `(em português) ${text}` : text });
  chat.turns.push({ role: 'user', text, lang });
  await aiTurn();
}
$('#sendChat').onclick = () => { const v = $('#chatInput').value.trim(); $('#chatInput').value = ''; send(v); };
$('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#sendChat').click(); } });
$('#chatMic').onclick = () => micToggle($('#chatMic'), (text) => send(text));
$('#chatMicPt').onclick = () => micToggle($('#chatMicPt'), (text) => send(text, 'portuguese'), 'portuguese');
$('#endChat').onclick = async () => {
  stopAudio();
  if (!chat.turns.some((t) => t.role === 'user')) { chat = null; return renderConversar(); }
  const r = $('#review'); r.hidden = false; r.innerHTML = '<p class="muted">Analisando sua conversa…</p>';
  $('#endChat').disabled = true;
  try {
    const { resumo, erros, pronuncia } = await api.ai('review', { messages: chat.messages, level: state.level });
    state.convs++; save();
    r.innerHTML = `<p class="eyebrow">CORREÇÃO</p><p class="lead-dark">${esc(resumo)}</p>
      ${erros.map((e, i) => `<div class="fix"><p class="said">✗ ${esc(e.voce_disse)}</p><p class="right">✓ ${esc(e.natural)} <button class="mini-play" data-fix-play="${i}">▶</button></p><p class="muted">${esc(e.explicacao)}</p></div>`).join('')}
      ${pronuncia.length ? `<p class="eyebrow">PRONÚNCIA · a máquina entendeu errado</p>${pronuncia.map((p, i) => `<div class="fix"><p>Ouviu <span class="said">“${esc(p.ouvido)}”</span>, você quis dizer <span class="right">“${esc(p.provavel)}”</span> <button class="mini-play" data-pron-play="${i}">▶</button></p><p class="muted">${esc(p.dica)}</p></div>`).join('')}` : ''}
      <div class="row">${erros.length ? '<button class="primary-button" id="addFixes">+ Transformar erros em frases de revisão</button>' : ''}<button class="outline-button" id="newChat">Nova conversa</button></div>`;
    r.querySelectorAll('[data-fix-play]').forEach((b) => { b.onclick = () => say(erros[b.dataset.fixPlay].natural); });
    r.querySelectorAll('[data-pron-play]').forEach((b) => { b.onclick = () => say(pronuncia[b.dataset.pronPlay].provavel); });
    if (erros.length) $('#addFixes').onclick = (ev) => { const n = addCards(erros.map((e) => ({ en: e.natural, pt: `Diga certo: “${e.voce_disse}”` })), 'Meus erros'); ev.target.disabled = true; ev.target.textContent = `${n} frases adicionadas ✓`; };
    $('#newChat').onclick = () => { chat = null; r.hidden = true; renderConversar(); };
    r.scrollIntoView({ behavior: 'smooth' });
  } catch (e) { r.innerHTML = `<p class="bad">${esc(errMsg(e))}</p>`; }
  $('#endChat').disabled = false;
};

// ---------- OUVIR ----------
let ep = null;
function renderOuvir() {
  $('#listenClock').textContent = clock(today().ouvir || 0);
  $('#epTopic').placeholder = `Assunto (vazio = surpresa, ex.: ${pick(EPISODE_TOPICS)})`;
  $('#resourceList').innerHTML = LISTENING.map((r) => `<a class="card resource" href="${r.url}" target="_blank"><strong>${esc(r.title)} <span class="level">${r.level}</span> ↗</strong><small>${esc(r.desc)}</small></a>`).join('');
  renderEpisode();
}
$('#listenToggle').onclick = () => { listening = !listening; $('#listenToggle').textContent = listening ? 'Pausar' : 'Iniciar'; if (!listening) save(); };
$('#genEpisode').onclick = async () => {
  const topic = $('#epTopic').value.trim() || pick(EPISODE_TOPICS);
  const btn = $('#genEpisode'); btn.disabled = true; btn.textContent = 'Escrevendo…';
  try {
    const known = state.cards.filter((c) => !c.isNew).sort(() => Math.random() - 0.5).slice(0, 25).map((c) => c.en);
    const data = await api.ai('episode', { topic, level: state.level, known });
    const voices = { A: pick(['af_heart', 'af_bella', 'bf_emma']), B: pick(['am_michael', 'bm_george', 'am_puck']) };
    ep = { data, voices, step: 1, answers: {}, rate: 0.9 };
    data.lines.forEach((l) => prefetch(l.text, voices[l.speaker]));
    $('#epTopic').value = ''; renderEpisode();
  } catch (e) { toast(errMsg(e)); }
  btn.disabled = false; btn.textContent = 'Gerar episódio';
};
async function playEpisode() {
  const run = ++epRun;
  for (const l of ep.data.lines) {
    await speakNow(l.text, { voice: ep.voices[l.speaker], rate: ep.rate });
    await new Promise((r) => setTimeout(r, 350));
    if (run !== epRun) return;
  }
}
function renderEpisode() {
  const el = $('#episode');
  if (!ep) { el.innerHTML = ''; return; }
  const { data, step } = ep;
  el.innerHTML = `<div class="card episode">
    <p class="eyebrow">EPISÓDIO · ${data.lines.length} falas</p><h2>${esc(data.title)}</h2>
    <div class="steps">${['Ouça sem ler', 'Responda', 'Confira e repita'].map((s, i) => `<span class="${step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
    <div class="row"><button class="primary-button" id="epPlay">▶ Tocar o diálogo</button><button class="outline-button" id="epStop">⏸ Parar</button>
      <label class="toggle">Velocidade <select id="epRate">${[0.75, 0.9, 1].map((r) => `<option ${r === ep.rate ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      ${step === 1 ? '<button class="outline-button" id="epNext">Já ouvi 2× → perguntas</button>' : ''}</div>
    ${step >= 2 ? `<div class="quiz">${data.questions.map((q, qi) => `<div class="q"><p>${esc(q.q)}</p>${q.options.map((o, oi) => {
      const a = ep.answers[qi], cls = a === undefined ? '' : oi === q.answer ? 'right-opt' : oi === a ? 'wrong-opt' : '';
      return `<button class="opt ${cls}" data-q="${qi}" data-o="${oi}" ${a !== undefined ? 'disabled' : ''}>${esc(o)}</button>`; }).join('')}</div>`).join('')}</div>` : ''}
    ${step >= 3 ? `<p class="eyebrow">TRANSCRIÇÃO · ${esc(data.title_pt)}</p>${data.lines.map((l) => phraseCard(l.text, { voice: ep.voices[l.speaker], pt: l.pt, label: l.speaker })).join('')}
      <div class="row"><button class="primary-button" id="epSave">+ Salvar ${data.phrases.length} frases úteis</button><span class="muted small">${data.phrases.map((p) => esc(p.en)).join(' · ')}</span></div>` : ''}
  </div>`;
  $('#epPlay').onclick = playEpisode; $('#epStop').onclick = stopAudio;
  $('#epRate').onchange = (e) => { ep.rate = +e.target.value; };
  if (step === 1) $('#epNext').onclick = () => { ep.step = 2; renderEpisode(); };
  el.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => {
    const qi = +b.dataset.q, oi = +b.dataset.o; ep.answers[qi] = oi;
    state.quiz.n++; if (oi === data.questions[qi].answer) state.quiz.ok++; save();
    if (Object.keys(ep.answers).length === data.questions.length) ep.step = 3;
    renderEpisode();
  }; });
  el.querySelectorAll('.ph-text').forEach((p) => { p.dataset.act = 'pt'; p.title = 'Clique para ver em português'; });
  if (step >= 3) $('#epSave').onclick = (e) => { const n = addCards(data.phrases, 'Episódios'); e.target.disabled = true; e.target.textContent = `${n} frases salvas ✓`; };
}

// ---------- MÓDULOS (curso de 12 semanas, áudio VoiceStudio) ----------
let openModule = null, modRate = 1;
const MOD_VOICE = { A: 'af_heart', B: 'bm_george' }, MOD_NAME = { A: 'Sarah', B: 'George' };
const modSrc = (m, kind, i) => `modulos/m${String(m.id).padStart(2, '0')}-${kind}${String(i + 1).padStart(2, '0')}.ogg`;
function renderModulos() {
  const el = $('#modulos'), wk = ((weekNumber() - 1) % MODULES.length) + 1;
  if (!openModule) {
    const done = MODULES.filter((m) => state.modules[m.id]).length;
    el.innerHTML = `<div class="page-intro"><p class="eyebrow">CURSO · ${done}/${MODULES.length} CONCLUÍDOS</p><h1>Módulos<span>.</span></h1><p>Um módulo por semana. Cada um tem um diálogo gravado com vozes nativas (Sarah, americana, e George, britânico), frases-chave, o som da semana e uma conversa para praticar.</p></div>
      <div class="module-grid">${MODULES.map((m) => `<button class="module-card ${state.modules[m.id] ? 'done' : ''} ${m.id === wk ? 'now' : ''}" data-mod="${m.id}">
        <span class="mod-n">${state.modules[m.id] ? '✓' : String(m.id).padStart(2, '0')}</span><strong>${esc(m.title)}</strong><small>${esc(m.goal)}</small>${m.id === wk ? '<span class="tag">Semana atual</span>' : ''}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-mod]').forEach((b) => { b.onclick = () => { openModule = +b.dataset.mod; renderModulos(); window.scrollTo({ top: 0 }); }; });
    return;
  }
  const m = MODULES.find((x) => x.id === openModule), s = SOUNDS[m.sound], sc = SCENARIOS.find((x) => x.id === m.scenario);
  el.innerHTML = `<button class="outline-button back" id="modBack">← Módulos</button>
    <div class="page-intro"><p class="eyebrow">MÓDULO ${String(m.id).padStart(2, '0')}${state.modules[m.id] ? ' · CONCLUÍDO ✓' : ''}</p><h1>${esc(m.title)}<span>.</span></h1><p>${esc(m.goal)}</p></div>
    <div class="card"><p class="eyebrow">1 · OUÇA SEM LER (2×)</p>
      <div class="row"><button class="primary-button" id="modPlay">▶ Tocar o diálogo</button><button class="outline-button" id="modStop">⏸ Parar</button>
      <label class="toggle">Velocidade <select id="modRate">${[0.75, 0.9, 1].map((r) => `<option ${r === modRate ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <span class="muted small" id="modNow"></span></div></div>
    <details class="card mod-step"><summary><span class="eyebrow">2 · LEIA E REPITA</span> <span class="muted small">George faz o seu papel: grave as falas dele 🎤</span></summary>
      ${m.lines.map(([who, en, pt], i) => phraseCard(en, { voice: MOD_VOICE[who], pt, label: MOD_NAME[who][0], src: modSrc(m, 'd', i), topic: s.title })).join('')}
      <p class="muted small">Clique no texto de uma fala para ver a tradução.</p></details>
    <div class="card"><p class="eyebrow">3 · FRASES-CHAVE</p>${m.phrases.map(([en, pt], i) => phraseCard(en, { pt, src: modSrc(m, 'f', i), topic: s.title })).join('')}
      <button class="primary-button" id="modAdd">+ Levar as ${m.phrases.length} frases para a revisão</button></div>
    <div class="card"><p class="eyebrow">4 · PRATIQUE</p><div class="row">
      <button class="outline-button" id="modSound">◉ Treinar o som: ${esc(s.title)}</button>
      <button class="outline-button" id="modChat">✦ Conversar: ${esc(sc.title)} com ${esc(sc.partner)}</button></div></div>
    <button class="primary-button hero-button" id="modDone">${state.modules[m.id] ? '✓ Módulo concluído (clique para desmarcar)' : '✓ Concluir módulo'}</button>`;
  el.querySelectorAll('.mod-step .ph-text, .card .ph-text').forEach((p) => { p.dataset.act = 'pt'; p.title = 'Clique para ver em português'; });
  $('#modBack').onclick = () => { stopAudio(); openModule = null; renderModulos(); };
  $('#modRate').onchange = (e) => { modRate = +e.target.value; };
  $('#modStop').onclick = () => { stopAudio(); $('#modNow').textContent = ''; };
  $('#modPlay').onclick = async () => {
    const run = ++epRun;
    for (const [i, [who, en]] of m.lines.entries()) {
      $('#modNow').textContent = `${MOD_NAME[who]} · fala ${i + 1}/${m.lines.length}`;
      await playFile(modSrc(m, 'd', i), en, { voice: MOD_VOICE[who], rate: modRate });
      await new Promise((r) => setTimeout(r, 450));
      if (run !== epRun) return;
    }
    $('#modNow').textContent = 'Fim. Ouça de novo ou abra o passo 2.';
  };
  $('#modAdd').onclick = (e) => { const n = addCards(m.phrases.map(([en, pt]) => ({ en, pt })), `Módulo ${m.id}`); e.target.disabled = true; e.target.textContent = `${n} frases na revisão ✓`; };
  $('#modSound').onclick = () => { state.soundPick = m.sound === weekSound() ? null : m.sound; save(); show('pronuncia'); };
  $('#modChat').onclick = () => { show('conversar'); startChat(sc); };
  $('#modDone').onclick = () => { state.modules[m.id] = !state.modules[m.id]; save(); if (state.modules[m.id]) toast(`Módulo ${m.id} concluído! 🎉`); renderModulos(); };
}

// ---------- PROGRESSO + RAIO-X ----------
function renderProgresso() {
  const totalMin = Object.keys(state.days).reduce((a, k) => a + dayMinutes(k), 0);
  const learned = state.cards.filter((c) => !c.isNew).length, mature = state.cards.filter((c) => c.ivl >= 21).length;
  const pron = Object.values(state.pron).reduce((a, p) => [a[0] + p.ok, a[1] + p.n], [0, 0]);
  const stats = [
    ['HORAS', (totalMin / 60).toFixed(1), 'de estudo acumuladas'],
    ['SEQUÊNCIA', streak(), 'dias com 15+ min'],
    ['FRASES', learned, `${mature} já firmes (21+ dias)`],
    ['CONVERSAS', state.convs, 'corrigidas'],
    ['OUVIDO', state.quiz.n ? `${Math.round(state.quiz.ok / state.quiz.n * 100)}%` : '–', 'acertos nos episódios'],
    ['PRONÚNCIA', pron[1] ? `${Math.round(pron[0] / pron[1] * 100)}%` : '–', 'pares mínimos certos'],
    ['NÍVEL', state.level, state.xrays.length ? 'pelo último Raio-X' : 'faça o Raio-X'],
    ['SEMANA', `${((weekNumber() - 1) % 12) + 1}/12`, 'do ciclo atual']
  ];
  $('#statsGrid').innerHTML = stats.map(([a, b, c]) => `<div class="stat-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></div>`).join('');
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
  const max = Math.max(60, ...days.map((d) => dayMinutes(dayKey(d))));
  $('#chart').innerHTML = days.map((d) => { const m = Math.round(dayMinutes(dayKey(d))); return `<div class="col" title="${m} min"><span class="val">${m || ''}</span><span class="fill ${m >= 15 ? '' : 'low'}" style="height:${m / max * 100}%"></span><small>${d.getDate()}</small></div>`; }).join('');
  renderXray();
}
function renderXray(result = null) {
  $('#xray').innerHTML = `
    <p class="eyebrow">🩻 RAIO-X DA FALA · uma vez por mês</p>
    <h2>${esc(XRAY_PROMPT)}</h2>
    <p class="muted small">Pode começar com: ${XRAY_STARTERS.map(esc).join(' · ')}</p>
    <div class="row"><button class="mic primary big" id="xrayMic">🎤 Gravar Raio-X</button><span class="muted" id="xrayClock"></span></div>
    <div id="xrayResult">${result || ''}</div>
    ${state.xrays.length ? `<p class="eyebrow">HISTÓRICO</p><table class="xray-table"><tr><th>Data</th><th>Nível</th><th>Palavras/min</th><th>Palavras diferentes</th><th></th></tr>${state.xrays.map((x, i) => `<tr><td>${x.date}</td><td>${esc(x.analysis?.nivel || '–')}</td><td>${x.wpm}</td><td>${x.unique}</td><td><button class="mini-play" data-xplay="${i}">▶ ouvir</button></td></tr>`).reverse().join('')}</table>` : ''}`;
  $('#xray').querySelectorAll('[data-xplay]').forEach((b) => { b.onclick = async () => { const x = state.xrays[b.dataset.xplay]; playBlob(new Blob([await api.readFile(x.file)])); }; });
  let timer;
  $('#xrayMic').onclick = () => {
    const btn = $('#xrayMic');
    if (!rec) {
      let s = 90;
      timer = setInterval(() => { if (!rec) return clearInterval(timer); $('#xrayClock').textContent = `${--s}s · clique para terminar`; if (s <= 0) btn.click(); }, 1000);
    } else { clearInterval(timer); $('#xrayClock').textContent = 'Transcrevendo… (até ~30s)'; }
    micToggle(btn, async (transcript, r) => {
      const words = norm(transcript), seconds = Math.round(r.seconds);
      const x = { date: dayKey(), seconds, words: words.length, unique: new Set(words).size, wpm: Math.round(words.length / (r.seconds / 60)), transcript, file: `raiox-${Date.now()}.webm` };
      await api.saveFile(x.file, await r.blob.arrayBuffer());
      $('#xrayClock').textContent = 'Analisando…';
      try {
        x.analysis = await api.ai('xray', { transcript, seconds, level: state.level });
        const lvl = x.analysis.nivel.slice(0, 2).toUpperCase();
        if (['A1', 'A2', 'B1'].includes(lvl)) state.level = lvl; // o sistema se ajusta ao seu nível real
      } catch (e) { toast(`Gravação salva, mas sem análise: ${errMsg(e)}`); }
      state.xrays.push(x); save();
      const a = x.analysis;
      renderXray(`<div class="xray-out">
        <div class="stats-grid mini"><div class="stat-card"><span>NÍVEL</span><strong>${esc(a?.nivel || '–')}</strong></div><div class="stat-card"><span>PALAVRAS/MIN</span><strong>${x.wpm}</strong></div><div class="stat-card"><span>DIFERENTES</span><strong>${x.unique}</strong></div><div class="stat-card"><span>TEMPO</span><strong>${seconds}s</strong></div></div>
        <p class="muted">A máquina entendeu: “${esc(transcript)}”</p>
        ${a ? `<p>${esc(a.resumo)}</p><p><b>Pontos fortes:</b> ${a.pontos_fortes.map(esc).join(' · ')}</p><p><b>Prioridades agora:</b></p><ol>${a.prioridades.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <p><b>Como um nativo diria:</b> ${esc(a.versao_melhorada)} <button class="mini-play" id="xrayBetter">▶</button></p>` : ''}</div>`);
      if (a) $('#xrayBetter').onclick = () => say(a.versao_melhorada);
    });
  };
}

// ---------- AJUSTES ----------
async function openSettings() {
  $('#keyStatus').textContent = (await api.hasKey()) ? '(cadastrada ✓)' : '(não cadastrada)';
  $('#keyInput2').value = ''; $('#levelSel').value = state.level;
  $('#goalWeekday').value = state.goals.weekday; $('#goalWeekend').value = state.goals.weekend;
  $('#newPerDay').value = state.newPerDay;
  $('#reminderOn').checked = Boolean(state.reminder); $('#reminderTime').value = state.reminder || '19:00';
  $('#settings').classList.add('open');
}
$('#openSettings').onclick = openSettings;
$('#closeSettings').onclick = () => $('#settings').classList.remove('open');
$('#saveSettings').onclick = async () => {
  const k = $('#keyInput2').value.trim(); if (k) await api.setKey(k);
  const clamp = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(+v) || d));
  state.level = $('#levelSel').value;
  state.goals = { weekday: clamp($('#goalWeekday').value, 15, 180, 60), weekend: clamp($('#goalWeekend').value, 15, 180, 60) };
  state.newPerDay = clamp($('#newPerDay').value, 0, 30, 10);
  const reminder = $('#reminderOn').checked ? $('#reminderTime').value : null;
  if (reminder !== state.reminder) {
    const ok = await api.setReminder(reminder);
    if (ok) state.reminder = reminder;
    toast(ok ? (reminder ? `O Windows vai abrir o TalkReady todo dia às ${reminder}.` : 'Lembrete desligado.') : 'Não consegui criar o lembrete no Agendador do Windows.');
  }
  queue = []; save();
  $('#settings').classList.remove('open'); show(current);
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#settings').classList.remove('open'); });

save(); show('hoje');
