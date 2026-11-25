// Prompts, esquemas e modelo de cada tarefa de IA. Usado pelo app de PC (main.js) e pela versão web/iPhone (web-api.js).
(function (root) {
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

  respell: ({ texts }) => ({
    effort: 'low',
    system: `Você escreve a pronúncia de frases em inglês com a escrita do português do Brasil, para um brasileiro ler em voz alta e soar o mais perto possível do inglês americano falado de verdade (ritmo e emendas naturais, não palavra por palavra de dicionário).
Regras:
- Palavras separadas por espaço. Quando duas palavras se emendam na fala, junte com "‿" (ex.: "uóts‿iór NÊIM").
- Palavra com 2+ sílabas: sílabas separadas por hífen e a sílaba forte em MAIÚSCULAS ("â-BAUT", "PRÓ-blâm"). Monossílabo forte em MAIÚSCULAS, palavra fraca (artigos, preposições, auxiliares) em minúsculas.
- "â" = som neutro (schwa). "th" = TH com a língua entre os dentes (nunca troque por f, t, d ou s). R sempre "r", nunca "rr". W = "u" ("uót"), Y = "i" ("iés"), J = "dj", CH = "tch", SH = "ch", S com som de Z = "z".
- Vogal longa com letra dobrada ("chiip" para sheep, "chip" para ship; "fuud" para food, "fud" para foot quando curto). Use é/ó para vogal aberta e ê/ô para fechada quando ajudar.
- Nunca acrescente vogal no fim de consoante nem antes de S inicial: "stop" = "stóp" (nunca "stópi"), "school" = "skuul" (nunca "isskul"), "big" = "big" (nunca "bigui").
- Formas fracas como se fala de verdade: "to" = "tâ", "and" = "ân", "for" = "fâr", "can" = "kân", "you" no fim de pergunta pode virar "iâ".
- Mantenha a pontuação final (?, !).
Devolva um item para cada frase recebida, com "en" exatamente igual ao texto original.`,
    messages: [{ role: 'user', content: `Frases:\n${texts.map((t) => `- ${t}`).join('\n')}` }],
    schema: obj({ itens: arr(obj({ en: str, som: str })) })
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

// Modelo por tarefa: conversa e conteúdo no Sonnet (rápido), frases no Haiku (simples),
// análise da sua fala no Opus (onde a qualidade da correção importa).
const MODELS = {
  chat: 'claude-sonnet-5-5',
  episode: 'claude-sonnet-5-5',
  deck: 'claude-haiku-5-5',
  review: 'claude-opus-5-5',
  why: 'claude-opus-5-5',
  respell: 'claude-sonnet-5-5',
  xray: 'claude-opus-5-5'
};

// Corpo da requisição para /v1/messages. withEffort=false é o plano B se o modelo recusar o parâmetro.
function request(kind, payload, { withEffort = true } = {}) {
  const { effort, system, messages, schema } = KINDS[kind](payload);
  const format = { type: 'json_schema', schema };
  return { model: MODELS[kind], max_tokens: 16000, system, messages, output_config: withEffort ? { effort, format } : { format } };
}

const api = { LEVELS, MODELS, KINDS, request };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.TR_PROMPTS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
