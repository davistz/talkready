// Lógica pura (sem DOM), usada pelo app. `node logic.js` roda a autoverificação.
const DAY = 86400000;

// Normaliza fala/frase em palavras comparáveis ("3" vira "three", que é como o Whisper às vezes escreve).
const NUM = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => NUM[w] || w);

// Quais palavras da frase alvo a máquina ouviu, na ordem (maior subsequência comum de palavras).
function compareWords(target, said) {
  const a = norm(target), b = norm(said);
  const L = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Set();
  for (let i = 0, j = 0; i < a.length && j < b.length;) { if (a[i] === b[j]) { hit.add(i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  return { score: a.length ? Math.round(hit.size / a.length * 100) : 0, words: a.map((w, i) => [w, hit.has(i)]) };
}

// SM-2 simplificado. g: 0 errei, 1 difícil, 2 bom, 3 fácil. "Errei" volta agora; o resto vence à meia-noite do dia certo.
function schedule({ ivl, ease }, g, now, midnight) {
  if (g === 0) return { ivl: 0, ease: Math.max(1.3, ease - 0.2), due: now };
  const next = ivl === 0 ? [0, 1, 1, 4][g] : Math.max(ivl + 1, Math.round(ivl * [0, 1.2, ease, ease * 1.3][g]));
  return { ivl: next, ease: Math.max(1.3, ease + [0, -0.15, 0, 0.15][g]), due: midnight + next * DAY };
}

if (typeof module !== 'undefined' && require.main === module) {
  const assert = require('node:assert');
  assert.deepStrictEqual(norm("I'm  Davi, 3 dogs!"), ["i'm", 'davi', 'three', 'dogs']);
  assert.strictEqual(compareWords('I think so.', 'I fink so').score, 67);
  assert.strictEqual(compareWords('Sorry, can you say that again?', 'sorry can you say that again').score, 100);
  assert.strictEqual(compareWords('one two three', 'three two one').score, 33);
  assert.strictEqual(compareWords('Hi.', '').score, 0);
  assert.deepStrictEqual(schedule({ ivl: 0, ease: 2.5 }, 2, 5, 0), { ivl: 1, ease: 2.5, due: DAY });
  assert.strictEqual(schedule({ ivl: 0, ease: 2.5 }, 3, 5, 0).ivl, 4);
  assert.strictEqual(schedule({ ivl: 10, ease: 2.5 }, 2, 5, 0).ivl, 25);
  assert.strictEqual(schedule({ ivl: 1, ease: 2.5 }, 1, 5, 0).ivl, 2);
  assert.deepStrictEqual(schedule({ ivl: 10, ease: 1.4 }, 0, 123, 0), { ivl: 0, ease: 1.3, due: 123 });
  console.log('logic ok');
}
