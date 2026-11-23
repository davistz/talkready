// Confiança do Whisper em cada palavra da frase alvo.
// Na transcrição normal o Whisper escolhe a palavra mais provável e "corrige" a pronúncia
// ("I fink so" sai "I think so"). Aqui damos a frase certa a ele e medimos o quanto o áudio
// sustenta cada palavra (teacher forcing). Palavra com probabilidade baixa = som duvidoso.
// Usado pelo app de PC (speech.js) e pela versão web (asr-worker.js).
(function (root) {
  const hasSound = (s) => /[\p{L}\p{N}]/u.test(s);

  async function assess({ model, processor, tokenizer, Tensor }, pcm, target) {
    const { input_features } = await processor(pcm);
    const prefix = tokenizer.model.convert_tokens_to_ids(['<|startoftranscript|>', '<|en|>', '<|transcribe|>', '<|notimestamps|>']);
    const text = tokenizer.encode(' ' + String(target).trim(), null, { add_special_tokens: false });
    const ids = [...prefix, ...text];
    const decoder_input_ids = new Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), [1, ids.length]);
    const { logits } = await model({ input_features, decoder_input_ids });
    const V = logits.dims.at(-1), d = logits.data;
    const raw = tokenizer.model.convert_ids_to_tokens(text);

    const groups = [];
    for (let k = prefix.length; k < ids.length; k++) {
      const row = (k - 1) * V; // a posição k-1 prevê o token k
      let max = -Infinity;
      for (let v = 0; v < V; v++) if (d[row + v] > max) max = d[row + v];
      let sum = 0;
      for (let v = 0; v < V; v++) sum += Math.exp(d[row + v] - max);
      const lp = d[row + ids[k]] - max - Math.log(sum);
      const tok = raw[k - prefix.length], piece = tokenizer.decode([ids[k]]);
      if (!groups.length || tok.startsWith('Ġ')) groups.push({ ids: [], lps: [] });
      const g = groups.at(-1);
      g.ids.push(ids[k]);
      if (hasSound(piece)) g.lps.push(lp); // pontuação não conta: "." ou "?" não é pronúncia
    }
    return groups.map((g) => ({ text: tokenizer.decode(g.ids).trim(), p: g.lps.length ? Math.exp(Math.min(...g.lps)) : 1 }));
  }

  const api = { assess };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WhisperScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
