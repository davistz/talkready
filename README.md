# TalkReady

Sistema pessoal para aprender inglês de conversa em 1 hora por dia. O método está em [ESTUDO.md](ESTUDO.md).

## Abrir

Duplo clique no atalho **TalkReady** da Área de Trabalho. A alternativa é `abrir-talkready.bat`, que instala as dependências se faltarem.

Na primeira vez:

1. **Ajustes → API key do Claude.** Ela fica criptografada pelo Windows, só neste usuário.
2. **Progresso → Raio-X do dia 1.** São 90 segundos falando: é o seu "antes".
3. **Hoje → Começar treino guiado.**

## O que tem

| Área | O que faz |
|---|---|
| **Hoje** | Meta do dia, os blocos com timer, missão da semana, fase do ciclo de 12 semanas e áudio para o carro. A rotina sugerida separa dias silenciosos de escuta de 2 sessões semanais de fala. |
| **Módulos** | Curso de 12 módulos (um por semana). Cada um tem um diálogo gravado com vozes nativas do VoiceStudio (Sarah, americana; George, britânico), frases-chave, o som da semana e uma conversa para praticar. |
| **Frases** | Repetição espaçada **falada**: você vê o português, fala, e o app confere o que ouviu. Gera frases com IA sobre qualquer assunto. |
| **Pronúncia** | Som da semana (8 sons que travam brasileiros), pares mínimos com reconhecimento de voz, shadowing, "▶ Você × ▶ Original" e "Por que errei?" |
| **Conversar** | 8 situações com parceiros de sotaques diferentes. É por voz, com o texto escondido até você tentar entender. Tem tradução, ideias de resposta, botão **PT** para quando travar e correção no fim (erros viram frases de revisão). |
| **Ouvir** | Episódios gerados para o seu nível: ouvir sem ler → perguntas → transcrição com repetição. Também tem timer para vídeos e lista de canais. |
| **Progresso** | Horas, sequência, frases firmes, % de ouvido e de pronúncia, gráfico de 14 dias e **Raio-X** mensal com gravações para comparar |

**Atalhos:** `Espaço` liga e desliga o microfone · `Enter` mostra a resposta · `1`–`4` dá a nota da frase.

## Como funciona por dentro

- **Voz local, sem custo:** Whisper (reconhecimento) e Kokoro (voz natural em inglês) rodam no próprio PC. Os modelos (~330 MB) ficam em `%LOCALAPPDATA%\TalkReady\models` e já estão baixados nesta máquina.
- **IA (Claude Opus 5.5):** usada na conversa, nas correções, nos episódios, nas frases geradas, no "por que errei?" e no Raio-X. Custo estimado: **~US$ 0,30 por dia de treino completo (~US$ 10/mês)**. Para gastar ~40× menos, troque `MODEL` em `main.js` para `claude-haiku-5-5`, com correções um pouco menos finas.
- **Áudio para o carro:** WAV salvo em `OneDrive\TalkReady - Áudios`. Pelo app do OneDrive, ele aparece no celular.
- **Lembrete:** em Ajustes, o Windows pode abrir o TalkReady todo dia num horário (Agendador de Tarefas).
- **Dados:** progresso no armazenamento do app (`%APPDATA%\talkready`). Gravações do Raio-X ficam em `%APPDATA%\talkready\gravacoes`.
- **Áudio dos módulos:** gerado uma vez no VoiceStudio e salvo em `modulos/`. Cada fala é conferida pelo Whisper e refeita com outra semente se ele não entender. O resultado fica em `modulos/relatorio.json`. Se você editar `modules.js`, apague os `.ogg` alterados, abra o VoiceStudio e rode `node_modules\electron\dist\electron.exe ferramentas\gerar-modulos.cjs`. Sem o arquivo, o app usa a voz local.
- **Conteúdo editável:** frases iniciais, sons, situações, missões e canais estão em [data.js](data.js).

## Problemas comuns

- **"Não consegui usar o microfone":** Configurações do Windows → Privacidade → Microfone → permitir apps da área de trabalho.
- **"Voz local indisponível":** feche e abra o app. Se o modelo não estiver baixado, ele baixa sozinho (precisa de internet uma vez).
- **"API key inválida":** confira em Ajustes. A key começa com `sk-ant-`.
