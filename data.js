// Conteúdo do sistema. Editar aqui muda o app.

// [inglês, português, tema] — ordem = ordem em que entram na revisão (kit de sobrevivência primeiro).
const STARTER_DECK = [
  ['Sorry, can you say that again?', 'Desculpa, pode repetir?', 'Kit'],
  ['Can you speak more slowly, please?', 'Pode falar mais devagar, por favor?', 'Kit'],
  ['Sorry, I didn\'t get that.', 'Desculpa, não peguei.', 'Kit'],
  ['What does that mean?', 'O que isso significa?', 'Kit'],
  ['How do you say "saudade" in English?', 'Como se diz "saudade" em inglês?', 'Kit'],
  ['I don\'t understand.', 'Eu não entendo.', 'Kit'],
  ['My English isn\'t very good, but I\'m learning.', 'Meu inglês não é muito bom, mas estou aprendendo.', 'Kit'],
  ['Let me think...', 'Deixa eu pensar...', 'Kit'],
  ['How can I say this...', 'Como posso dizer isso...', 'Kit'],
  ['I mean...', 'Quer dizer...', 'Kit'],
  ['Do you mean...?', 'Você quer dizer...?', 'Kit'],
  ['Is that right?', 'Está certo?', 'Kit'],
  ['Can you write it down for me?', 'Pode escrever pra mim?', 'Kit'],
  ['Exactly!', 'Exatamente!', 'Kit'],

  ['Hi, nice to meet you.', 'Oi, prazer em te conhecer.', 'Apresentar'],
  ['My name is Davi. What\'s your name?', 'Meu nome é Davi. Qual é o seu nome?', 'Apresentar'],
  ['I\'m from Brazil.', 'Eu sou do Brasil.', 'Apresentar'],
  ['Where are you from?', 'De onde você é?', 'Apresentar'],
  ['Where do you live?', 'Onde você mora?', 'Apresentar'],
  ['What do you do?', 'O que você faz? (trabalho)', 'Apresentar'],
  ['I work with data at a construction company.', 'Eu trabalho com dados numa construtora.', 'Apresentar'],
  ['Is this your first time in Brazil?', 'É sua primeira vez no Brasil?', 'Apresentar'],
  ['How long have you been here?', 'Há quanto tempo você está aqui?', 'Apresentar'],
  ['This is my friend.', 'Este é meu amigo.', 'Apresentar'],

  ['How\'s it going?', 'Como vai?', 'Conversa'],
  ['I\'m good, thanks. And you?', 'Estou bem, obrigado. E você?', 'Conversa'],
  ['Not bad.', 'Nada mal.', 'Conversa'],
  ['What about you?', 'E você?', 'Conversa'],
  ['Really?', 'Sério?', 'Conversa'],
  ['That\'s great!', 'Que ótimo!', 'Conversa'],
  ['That sounds fun!', 'Parece divertido!', 'Conversa'],
  ['That\'s too bad.', 'Que pena.', 'Conversa'],
  ['No way!', 'Não acredito!', 'Conversa'],
  ['I know what you mean.', 'Sei o que você quer dizer.', 'Conversa'],
  ['That makes sense.', 'Faz sentido.', 'Conversa'],
  ['I agree.', 'Concordo.', 'Conversa'],
  ['I don\'t think so.', 'Acho que não.', 'Conversa'],
  ['I\'m not sure.', 'Não tenho certeza.', 'Conversa'],
  ['Me too.', 'Eu também.', 'Conversa'],
  ['Me neither.', 'Nem eu.', 'Conversa'],
  ['Good question!', 'Boa pergunta!', 'Conversa'],
  ['Of course!', 'Claro!', 'Conversa'],
  ['No problem.', 'Sem problema.', 'Conversa'],
  ['Thank you so much.', 'Muito obrigado.', 'Conversa'],

  ['What do you think?', 'O que você acha?', 'Perguntar'],
  ['How was your weekend?', 'Como foi seu fim de semana?', 'Perguntar'],
  ['What did you do yesterday?', 'O que você fez ontem?', 'Perguntar'],
  ['What are you doing this weekend?', 'O que você vai fazer neste fim de semana?', 'Perguntar'],
  ['Do you like it here?', 'Você gosta daqui?', 'Perguntar'],
  ['Have you ever been to Brazil?', 'Você já foi ao Brasil?', 'Perguntar'],
  ['What do you like to do for fun?', 'O que você gosta de fazer para se divertir?', 'Perguntar'],
  ['What kind of music do you like?', 'Que tipo de música você gosta?', 'Perguntar'],
  ['Do you have any kids?', 'Você tem filhos?', 'Perguntar'],
  ['Where did you go?', 'Aonde você foi?', 'Perguntar'],
  ['How was it?', 'Como foi?', 'Perguntar'],
  ['Can I ask you something?', 'Posso te perguntar uma coisa?', 'Perguntar'],

  ['I usually wake up at six.', 'Eu geralmente acordo às seis.', 'Rotina'],
  ['I go to work by car.', 'Eu vou trabalhar de carro.', 'Rotina'],
  ['I work from eight to six.', 'Eu trabalho das oito às seis.', 'Rotina'],
  ['I\'m a bit tired today.', 'Estou um pouco cansado hoje.', 'Rotina'],
  ['I had a busy day.', 'Tive um dia corrido.', 'Rotina'],
  ['I usually have lunch at noon.', 'Eu geralmente almoço ao meio-dia.', 'Rotina'],
  ['On weekends, I like to rest.', 'Nos fins de semana, eu gosto de descansar.', 'Rotina'],
  ['I\'m on my way.', 'Estou a caminho.', 'Rotina'],
  ['I\'m running late.', 'Estou atrasado.', 'Rotina'],

  ['I went to the beach with my family.', 'Fui à praia com minha família.', 'Contar'],
  ['It was great!', 'Foi ótimo!', 'Contar'],
  ['It was a long day.', 'Foi um dia longo.', 'Contar'],
  ['I watched a movie last night.', 'Vi um filme ontem à noite.', 'Contar'],
  ['I didn\'t sleep well.', 'Não dormi bem.', 'Contar'],
  ['We had a good time.', 'A gente se divertiu.', 'Contar'],
  ['I\'m going to travel next month.', 'Vou viajar mês que vem.', 'Contar'],
  ['I\'m going to stay home.', 'Vou ficar em casa.', 'Contar'],
  ['I\'d like to visit New York someday.', 'Eu queria visitar Nova York um dia.', 'Contar'],
  ['I\'ve never been there.', 'Nunca fui lá.', 'Contar'],

  ['I like watching movies.', 'Eu gosto de ver filmes.', 'Gostos'],
  ['I love Brazilian food.', 'Eu amo comida brasileira.', 'Gostos'],
  ['I\'m really into technology.', 'Eu curto muito tecnologia.', 'Gostos'],
  ['I don\'t like it very much.', 'Não gosto muito.', 'Gostos'],
  ['I prefer coffee.', 'Eu prefiro café.', 'Gostos'],
  ['It\'s not my thing.', 'Não é minha praia.', 'Gostos'],
  ['You should try it!', 'Você deveria experimentar!', 'Gostos'],

  ['I\'m working on a new project.', 'Estou trabalhando num projeto novo.', 'Trabalho'],
  ['I build dashboards and reports.', 'Eu faço painéis e relatórios.', 'Trabalho'],
  ['Do you have a minute?', 'Você tem um minuto?', 'Trabalho'],
  ['Could you help me with this?', 'Você poderia me ajudar com isso?', 'Trabalho'],
  ['I\'ll check and get back to you.', 'Vou verificar e te retorno.', 'Trabalho'],
  ['Can you send me an email about it?', 'Você pode me mandar um e-mail sobre isso?', 'Trabalho'],
  ['Let\'s talk about it tomorrow.', 'Vamos falar sobre isso amanhã.', 'Trabalho'],
  ['Sorry for the delay.', 'Desculpa a demora.', 'Trabalho'],
  ['I\'m in a meeting right now.', 'Estou numa reunião agora.', 'Trabalho'],
  ['Let me share my screen.', 'Deixa eu compartilhar minha tela.', 'Trabalho'],

  ['Where is the bathroom?', 'Onde fica o banheiro?', 'Viagem'],
  ['I\'d like a coffee, please.', 'Eu queria um café, por favor.', 'Viagem'],
  ['How much is it?', 'Quanto custa?', 'Viagem'],
  ['Can I pay by card?', 'Posso pagar no cartão?', 'Viagem'],
  ['Excuse me, how do I get to the station?', 'Com licença, como chego à estação?', 'Viagem'],
  ['Is it far from here?', 'É longe daqui?', 'Viagem'],
  ['I have a reservation.', 'Tenho uma reserva.', 'Viagem'],
  ['A table for two, please.', 'Uma mesa para dois, por favor.', 'Viagem'],
  ['Can I have the check, please?', 'A conta, por favor.', 'Viagem'],
  ['I\'m just looking, thanks.', 'Só estou olhando, obrigado.', 'Viagem'],
  ['Can you take a picture of us?', 'Pode tirar uma foto da gente?', 'Viagem'],

  ['It was nice talking to you.', 'Foi bom conversar com você.', 'Encerrar'],
  ['I have to go now.', 'Tenho que ir agora.', 'Encerrar'],
  ['See you later!', 'Até mais!', 'Encerrar'],
  ['Talk to you soon!', 'A gente se fala!', 'Encerrar'],
  ['Have a nice day!', 'Tenha um bom dia!', 'Encerrar'],
  ['Take care!', 'Se cuida!', 'Encerrar'],
  ['Let\'s keep in touch.', 'Vamos manter contato.', 'Encerrar']
];

// Os sons que mais atrapalham brasileiros. Um por semana, em ciclo. `pairs` = pares mínimos (troca o som, muda a palavra).
const SOUNDS = [
  { title: 'Vogal fantasma', tip: 'Brasileiro coloca um "i" onde não existe: "eschool", "Facebooki", "stopi". Termine a palavra na consoante e comece direto no S.', phrases: ['I study at school.', 'Stop here, please.', 'I like big dogs.', 'She speaks Spanish.', 'Let\'s start now.'] },
  { title: 'TH', tip: 'Ponta da língua entre os dentes e solte o ar. Não vire "f", "t", "s" nem "d": think ≠ "fink", this ≠ "dis".', phrases: ['I think so.', 'Thank you for this.', 'The weather is nice.', 'This is my brother.', 'They\'re together.'], pairs: [['think', 'sink'], ['three', 'tree'], ['thank', 'tank'], ['thin', 'tin'], ['mouth', 'mouse'], ['they', 'day']] },
  { title: '-ED no passado', tip: 'Quase nunca é "éd". Depois de som surdo vira "t" (worked = "workt"), depois de sonoro vira "d" (played = "pleid"). Só é "id" depois de T ou D (wanted, needed).', phrases: ['I worked a lot yesterday.', 'We played soccer.', 'She watched a movie.', 'I wanted to call you.', 'I liked it.'] },
  { title: 'Vogal curta × longa', tip: 'ship (curta, boca relaxada) × sheep (longa, sorriso). full × fool. live × leave. Errar muda a palavra.', phrases: ['I live here, and I leave at six.', 'Is this a ship or a sheep?', 'Fill the cup, please.', 'Feel free to sit.', 'The pool is full.'], pairs: [['ship', 'sheep'], ['live', 'leave'], ['sit', 'seat'], ['fill', 'feel'], ['full', 'fool'], ['pull', 'pool']] },
  { title: 'H × R no começo', tip: 'O R inicial do português ("rato") soa como o H do inglês! Por isso "red" sai "head". R inglês: língua dobrada para trás, sem encostar em nada. H: só um sopro leve.', phrases: ['Right, I remember.', 'Red is my favorite color.', 'My house is here.', 'He has a happy dog.', 'Hurry up, we\'re late.'], pairs: [['red', 'head'], ['rat', 'hat'], ['ride', 'hide'], ['rope', 'hope'], ['rate', 'hate'], ['rare', 'hair']] },
  { title: 'Sílaba forte', tip: 'Errar a tônica confunde mais que errar um som. COMfortable, deVElop, PHOtograph × phoTOgraphy, VEgetable.', phrases: ['This chair is comfortable.', 'We develop software.', 'I took a photograph.', 'Photography is my hobby.', 'Eat your vegetables.'] },
  { title: 'Ritmo e palavras fracas', tip: 'Inglês "engole" palavras pequenas: to → "tə", and → "n", going to → "gonna". Força nas palavras importantes, o resto passa rápido.', phrases: ['I\'m going to eat.', 'Bread and butter.', 'What do you want to do?', 'I have to go.', 'I\'d like a cup of coffee.'] },
  { title: 'L no fim', tip: 'Brasileiro fala "Braziu". No inglês, a ponta da língua TOCA atrás dos dentes de cima e fica lá: fee-L, coo-L, Brazi-L.', phrases: ['I live in Brazil.', 'I feel well.', 'It\'s a cool school.', 'Call me tomorrow.', 'I\'ll tell you later.'] }
];

// Parceiros de conversa: sotaques diferentes (EUA e Reino Unido) para o ouvido não viciar numa voz só.
const SCENARIOS = [
  { id: 'meet', title: 'Conhecer alguém', desc: 'Nome, de onde é, o que faz.', partner: 'Sarah', voice: 'af_heart', prompt: 'You just met Davi at a coffee shop. Get to know him: name, where he is from, his job, his family.' },
  { id: 'day', title: 'Seu dia e rotina', desc: 'Como foi o dia, o que fez, planos.', partner: 'Mike', voice: 'am_michael', prompt: 'You are a friend asking Davi about his day, his routine and his plans for the weekend.' },
  { id: 'likes', title: 'Gostos e hobbies', desc: 'Filmes, música, comida, esporte.', partner: 'Bella', voice: 'af_bella', prompt: 'You are chatting with Davi about hobbies, movies, music, food and sports.' },
  { id: 'work', title: 'Trabalho', desc: 'Explicar o que você faz.', partner: 'George', voice: 'bm_george', prompt: 'You are a British colleague in a video call asking Davi about his work with data and reports at a construction company in Brazil.' },
  { id: 'brazil', title: 'Falar do Brasil', desc: 'Um gringo curioso sobre o Brasil.', partner: 'Jake', voice: 'am_puck', prompt: 'You are an American who has never been to Brazil and you are curious about Brazilian food, cities, weather, football and culture. You are planning a trip.' },
  { id: 'travel', title: 'Viagem', desc: 'Hotel, restaurante, informação.', partner: 'Emma', voice: 'bf_emma', prompt: 'Davi is traveling in London. Play different people he meets: hotel receptionist, waiter, someone on the street. Say who you are at the start.' },
  { id: 'phone', title: 'Ligação', desc: 'Sem ver a pessoa: só ouvido.', partner: 'Tom', voice: 'am_fenrir', prompt: 'This is a phone call. You are calling Davi to schedule a meeting next week. Talk naturally, like on the phone, and confirm details (day, time).' },
  { id: 'free', title: 'Papo livre', desc: 'Qualquer assunto que você puxar.', partner: 'Sarah', voice: 'af_heart', prompt: 'Free conversation. Let Davi choose the topic; if he does not, ask about something from his life.' }
];

// Missões no mundo real: uma por semana, levando até a conversa com um gringo de verdade.
const MISSIONS = [
  'Mude o idioma do celular para inglês. Imersão de graça, todo dia.',
  'Narre em voz alta, em inglês, o que você está fazendo ao chegar em casa ("I\'m opening the door...").',
  'Assista a um episódio de uma série que você já conhece, com áudio e legenda em inglês.',
  'Escreva sua lista de tarefas da semana em inglês.',
  'Crie conta no Tandem ou HelloTalk e mande mensagem para 3 pessoas. Você ensina português, elas ensinam inglês.',
  'Faça seu Raio-X do mês e compare com o do dia 1. Ouça as duas gravações.',
  'Primeira chamada de voz com um gringo (Tandem/HelloTalk) ou aula experimental no italki/Preply. 10 minutos bastam.',
  'Assista a um vídeo curto de Power BI em inglês (Guy in a Cube). Você conhece o assunto, então entende mais do que imagina.',
  'Explique seu trabalho por 2 minutos na conversa "Trabalho", sem pedir ajuda em português.',
  'Segunda chamada com gringo, 15 minutos. Anote o que você não soube dizer e transforme em frases de revisão.',
  'Um dia inteiro pensando em inglês no trânsito: descreva o que vê.',
  'Missão final: 15 minutos de conversa com um gringo + Raio-X final. Compare com o dia 1.'
];

// Buscas no YouTube (não quebram quando um vídeo sai do ar).
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const LISTENING = [
  { title: 'Peppa Pig em inglês', level: 'A1', desc: 'Sério: frases curtas, fala clara, vida cotidiana. Iniciante evolui muito com isso.', url: yt('Peppa Pig full episodes English') },
  { title: 'Comprehensible input', level: 'A1', desc: 'Professor falando devagar, com imagens. Entender sem traduzir.', url: yt('comprehensible input English beginner') },
  { title: 'Easy English', level: 'A2', desc: 'Entrevistas de rua com legenda em inglês e português.', url: yt('Easy English street interviews') },
  { title: 'BBC Learning English', level: 'A2', desc: 'Vídeos curtos e claros. Comece pela série "English at Work".', url: yt('BBC Learning English English at Work') },
  { title: 'Séries com legenda em inglês', level: 'B1', desc: 'Quando o resto ficar fácil: Friends ou Modern Family, legenda EM INGLÊS.', url: yt('Friends scenes with English subtitles') },
  { title: 'Power BI em inglês', level: 'Desafio', desc: 'Guy in a Cube. É o seu assunto: o contexto ajuda a entender.', url: yt('Guy in a Cube Power BI') }
];

const EPISODE_TOPICS = ['ordering coffee', 'meeting a new coworker', 'talking about the weekend', 'a day at the beach', 'a football match', 'asking for directions', 'checking in at a hotel', 'cooking dinner', 'a birthday party', 'buying clothes', 'a rainy day', 'talking about family', 'a problem with the internet', 'going to the doctor', 'planning a trip', 'buying a new phone', 'a job interview', 'a video call with a client', 'at the supermarket', 'renting a car'];

const XRAY_PROMPT = 'Fale por até 90 segundos sobre você: nome, de onde é, trabalho, rotina e do que gosta.';
const XRAY_STARTERS = ['My name is...', 'I\'m from...', 'I work...', 'Every day I...', 'On weekends I...', 'I like...'];
