# Prompt para o Claude Cowork: montar a nutrição do ConcerFinder no ActiveCampaign

> **Como usar:** cole este documento inteiro como prompt no Claude Cowork, com acesso ao navegador.
> Ele monta 3 automações no ActiveCampaign e devolve, no fim, um JSON que o Claude Code usa
> para terminar a integração.

---

## Contexto

O **ConcerFinder** (`https://finder.thiagoconcer.com.br`) é uma busca semântica sobre os vídeos do canal do Thiago Concer. A pessoa descreve uma dor de vendas em linguagem natural e recebe quais vídeos assistir, **o minuto exato** de cada insight e um plano de ação.

Todo cadastro vira lead. O sistema já grava no ActiveCampaign, via API, o perfil comercial da pessoa e **a dor real que ela pesquisou**, em campos personalizados. Sua tarefa é montar as automações que usam esses dados.

O diferencial desta régua é esse: ela fala da dor específica que a pessoa procurou, com o link do trecho no minuto certo. Não é newsletter genérica.

---

## O que já existe na conta (não precisa criar)

**Campos personalizados**, já criados e populados pelo sistema:

| Tag de personalização | Conteúdo | Exemplo |
|---|---|---|
| `%CF_DOR_PRINCIPAL%` | A dor que a pessoa escreveu na busca | "meu time não contorna objeção de preço" |
| `%CF_TEMAS_BUSCADOS%` | Temas detectados, separados por vírgula | "Objeção de preço, Gestão de equipe" |
| `%CF_VIDEO_RECOMENDADO%` | Título do vídeo mais relevante | "Como contornar a objeção de preço" |
| `%CF_LINK_TRECHO%` | Link direto do trecho no minuto | `https://finder.thiagoconcer.com.br/video/abc?t=349` |
| `%CF_MINUTAGEM%` | Minutagem do insight | "5:49" |
| `%CF_PERFIL_COMERCIAL%` | Vendedor / Gestor comercial / Dono de empresa | "Gestor comercial" |
| `%CF_TOTAL_BUSCAS%` | Quantas buscas a pessoa já fez | "3" |
| `%CF_DATA_CADASTRO_CONCERFINDER%` | Data do cadastro | "05/08/2026" |

Use também `%FIRSTNAME%` para o primeiro nome.

**Tags**, já criadas:

| Tag | Id | Papel |
|---|---|---|
| `concerfinder - lead` | 195 | Todo lead do ConcerFinder |
| `concerfinder - vendedor` | 196 | **Gatilho da automação 1** |
| `concerfinder - gestor` | 197 | **Gatilho da automação 2** |
| `concerfinder - dono` | 198 | **Gatilho da automação 3** |
| `concerfinder - regua d0` | 199 | Marcada após o e-mail 1 |
| `concerfinder - regua d2` | 200 | Marcada após o e-mail 2 |
| `concerfinder - regua d5` | 201 | Marcada após o e-mail 3 |
| `concerfinder - regua d9` | 202 | Marcada após o e-mail 4 |
| `newsletter gestores e donos` | 70 | Já aplicada pelo sistema |

---

## Configuração que vale para TODOS os e-mails

- **Remetente:** `Thiago Concer`
- **E-mail do remetente:** `time@thiagoconcer.com.br`
- **Responder para:** `suporte@anevedu.com.br`
- **Formato:** texto simples, sem template gráfico pesado. A régua tem que parecer e-mail de pessoa, não peça de marketing.
- **Idioma:** português brasileiro.
- **Não use travessão** (— ou –) em nenhum texto. Use vírgula, ponto, parênteses ou dois-pontos.
- Ao final de cada e-mail, mantenha o rodapé padrão da conta com o link de descadastro.

---

## O que construir

**Três automações**, uma por perfil comercial. Mesma estrutura, textos diferentes.

Estrutura de cada uma:

```
GATILHO: tag <perfil> é adicionada  (executa uma vez por contato)
   │
   ├─ Enviar E-MAIL 1
   ├─ Adicionar tag "concerfinder - regua d0"
   ├─ Esperar 2 dias
   ├─ Enviar E-MAIL 2
   ├─ Adicionar tag "concerfinder - regua d2"
   ├─ Esperar 3 dias
   ├─ Enviar E-MAIL 3
   ├─ Adicionar tag "concerfinder - regua d5"
   ├─ Esperar 4 dias
   ├─ Enviar E-MAIL 4
   └─ Adicionar tag "concerfinder - regua d9"
```

Nomes das automações:
1. `[CF] Nutrição ConcerFinder - Vendedor`
2. `[CF] Nutrição ConcerFinder - Gestor`
3. `[CF] Nutrição ConcerFinder - Dono`

**Deixe as três ativas ao final.**

---

# AUTOMAÇÃO 1: VENDEDOR
Gatilho: tag `concerfinder - vendedor`

### E-mail 1 (imediato)

**Assunto:** Achei o minuto exato, %FIRSTNAME%
**Preheader:** Sobre o que você procurou no ConcerFinder

```
%FIRSTNAME%, você entrou no ConcerFinder procurando isto:

"%CF_DOR_PRINCIPAL%"

Eu trato exatamente disso em "%CF_VIDEO_RECOMENDADO%", no minuto %CF_MINUTAGEM%.

Assista esse trecho: %CF_LINK_TRECHO%

Não é o vídeo inteiro. É o minuto onde ele responde a sua pergunta. Sua parte é
separar quatro minutos hoje e assistir antes de entrar na próxima ligação.

Uma coisa que eu quero deixar clara desde já: o ConcerFinder não foi feito para
você assistir mais vídeo. Foi feito para você parar de assistir vídeo procurando
resposta. Você descreve o problema, ele te leva ao ponto.

Nos próximos dias eu mando mais alguns cortes sobre esse mesmo tema.

Abraço,
**Thiago Concer**

PS: se aparecer outra dor no meio da semana, volta lá e descreve.
É de graça e ilimitado: https://finder.thiagoconcer.com.br/busca
```

### E-mail 2 (2 dias depois)

**Assunto:** A venda não se perde no fechamento
**Preheader:** Ela se perde umas três etapas antes

```
%FIRSTNAME%,

Tem uma coisa que separa o vendedor mediano do vendedor bom, e não é técnica de
fechamento.

O mediano trata a objeção como se ela tivesse nascido ali, na hora. O bom sabe
que ela nasceu lá atrás, quando ele não perguntou o suficiente. Quando o cliente
fala "vou pensar" ou "está caro", ele está devolvendo a conta de uma pergunta que
ninguém fez.

Você procurou sobre %CF_TEMAS_BUSCADOS%. Vale reassistir o trecho com essa lente:
%CF_LINK_TRECHO%

Um exercício para esta semana, e ele é chato de propósito: nas suas próximas
cinco conversas, conte quantas perguntas você faz antes de falar de preço, produto
ou proposta. Anote o número. Se for menos de cinco, achamos o problema.

Abraço,
**Thiago Concer**
```

### E-mail 3 (3 dias depois)

**Assunto:** Como treinar sem depender do seu gestor
**Preheader:** Vendedor bom não espera treinamento cair do céu

```
%FIRSTNAME%,

A maioria dos vendedores espera a empresa treinar. Os melhores treinam sozinhos,
e é isso que abre distância entre eles e o resto do time.

Treinar sozinho é mais simples do que parece:

1. Grave suas próprias ligações (com aviso ao cliente) e escute uma por semana.
   Você vai odiar a primeira. É assim mesmo.
2. Marque o momento exato em que a conversa virou contra você.
3. Descreva esse momento no ConcerFinder e veja o que eu falo sobre ele.
4. Repita a resposta em voz alta até sair natural. Não basta entender, tem que sair.

Esses quatro passos, toda semana, valem mais que qualquer curso que você comprar
este ano. E os três primeiros são de graça.

Buscar minha próxima dor: https://finder.thiagoconcer.com.br/busca

Abraço,
**Thiago Concer**
```

### E-mail 4 (4 dias depois)

**Assunto:** Qual é a dor da semana?
**Preheader:** Cinco minutos e uma frase

```
%FIRSTNAME%,

Fecha os olhos e responde: qual foi a conversa que mais te travou nos últimos
sete dias?

Essa é a sua próxima busca. Não precisa achar a palavra-chave certa, nem saber em
que vídeo está. Escreve do jeito que você contaria para um colega no corredor.

https://finder.thiagoconcer.com.br/busca

Você já fez %CF_TOTAL_BUSCAS% busca(s). Quem usa o ConcerFinder toda semana para de
acumular dúvida e passa a acumular resposta, e a diferença aparece na comissão.

Abraço,
**Thiago Concer**
```

---

# AUTOMAÇÃO 2: GESTOR COMERCIAL
Gatilho: tag `concerfinder - gestor`

### E-mail 1 (imediato)

**Assunto:** Achei o minuto exato, %FIRSTNAME%
**Preheader:** Sobre o que você procurou no ConcerFinder

```
%FIRSTNAME%, você entrou no ConcerFinder procurando isto:

"%CF_DOR_PRINCIPAL%"

Eu trato exatamente disso em "%CF_VIDEO_RECOMENDADO%", no minuto %CF_MINUTAGEM%.

Assista esse trecho: %CF_LINK_TRECHO%

Sugestão de gestor: não assista sozinho. Leve esse trecho para a reunião de segunda
e passe os quatro minutos com o time. Discussão em cima de um trecho curto rende
mais que treinamento de duas horas, porque todo mundo viu a mesma coisa.

Nos próximos dias eu mando mais cortes sobre esse tema, sempre com a minutagem.

Abraço,
**Thiago Concer**

PS: cada vendedor seu pode ter a conta dele e buscar as próprias dores.
É de graça: https://finder.thiagoconcer.com.br
```

### E-mail 2 (2 dias depois)

**Assunto:** Seu time não erra por falta de vontade
**Preheader:** Erra por falta de repetição

```
%FIRSTNAME%,

Quando um vendedor cede na primeira objeção, o problema quase nunca é ele. É que
ninguém nunca o colocou para treinar aquela resposta específica.

A gente cobra que o time não dê desconto, mas não senta para simular a conversa em
que o desconto aparece. Aí o vendedor entra na ligação com a teoria na cabeça e o
reflexo antigo na boca. Vence o reflexo.

Você procurou sobre %CF_TEMAS_BUSCADOS%. Vale rever o trecho pensando em como
transformar aquilo em role play: %CF_LINK_TRECHO%

Roteiro da próxima segunda, vinte minutos:

1. Assistam juntos o trecho (4 min).
2. Você faz o cliente difícil, um vendedor responde na frente dos colegas (5 min).
3. O time comenta o que funcionou, não o que ficou ruim (5 min).
4. Repete com outro vendedor (5 min).

Vinte minutos por semana. Em um mês você tem quatro simulações e um time que já
ouviu a objeção antes de ouvi-la de um cliente de verdade.

Abraço,
**Thiago Concer**
```

### E-mail 3 (3 dias depois)

**Assunto:** A reunião de segunda que muda o mês
**Preheader:** Sem PowerPoint, sem discurso motivacional

```
%FIRSTNAME%,

A maior parte das reuniões de segunda é leitura de número em voz alta. Todo mundo
já viu o número no CRM. O que ninguém treinou é o que fazer diferente na terça.

Uma estrutura que funciona:

1. Cinco minutos de número, e só. Sem discussão sobre o passado.
2. Uma dor real da semana, trazida por um vendedor. Real, com nome de cliente.
3. Um trecho meu sobre essa dor, com a minutagem, buscada no ConcerFinder.
4. Role play em cima do trecho.
5. Um combinado prático para a semana, escrito e visível.

O passo 3 é onde o ConcerFinder entra: você descreve a dor que o vendedor trouxe e
recebe o trecho pronto, no minuto certo. Sem você precisar lembrar em qual vídeo
estava, nem garimpar o canal na noite de domingo.

Preparar minha próxima reunião: https://finder.thiagoconcer.com.br/busca

Abraço,
**Thiago Concer**
```

### E-mail 4 (4 dias depois)

**Assunto:** O que travou seu time esta semana?
**Preheader:** Vira pauta de reunião em cinco minutos

```
%FIRSTNAME%,

Pergunta simples para fechar a semana: qual foi a venda que seu time perdeu e você
sabe que dava para ganhar?

Descreve essa situação no ConcerFinder. Em segundos você tem o trecho para levar
para a reunião, e um plano de ação para o time.

https://finder.thiagoconcer.com.br/busca

Você já fez %CF_TOTAL_BUSCAS% busca(s). Gestor que leva um trecho novo toda semana
constrói repertório no time sem gastar um real de treinamento.

Abraço,
**Thiago Concer**
```

---

# AUTOMAÇÃO 3: DONO DE EMPRESA
Gatilho: tag `concerfinder - dono`

### E-mail 1 (imediato)

**Assunto:** Achei o minuto exato, %FIRSTNAME%
**Preheader:** Sobre o que você procurou no ConcerFinder

```
%FIRSTNAME%, você entrou no ConcerFinder procurando isto:

"%CF_DOR_PRINCIPAL%"

Eu trato exatamente disso em "%CF_VIDEO_RECOMENDADO%", no minuto %CF_MINUTAGEM%.

Assista esse trecho: %CF_LINK_TRECHO%

São quatro minutos. Como dono, o melhor uso desse trecho não é você assistir e
guardar: é mandar para quem lidera o comercial e cobrar o que vai mudar na prática
por causa dele.

Nos próximos dias eu mando mais alguns cortes sobre esse tema.

Abraço,
**Thiago Concer**

PS: o acesso é gratuito e ilimitado. Vale colocar seu time comercial inteiro lá:
https://finder.thiagoconcer.com.br
```

### E-mail 2 (2 dias depois)

**Assunto:** Comercial não é custo, é sistema
**Preheader:** E sistema quebrado não se resolve trocando peça

```
%FIRSTNAME%,

Quando o resultado comercial não vem, o primeiro reflexo do dono é olhar para as
pessoas. Trocar o vendedor, trocar o gerente, contratar mais.

Na maioria das vezes o problema não está na pessoa, está no sistema em volta dela:
não existe processo escrito, não existe treino de repetição, não existe critério de
qualificação, e a meta é um número que ninguém sabe de onde saiu.

Trocar a pessoa dentro de um sistema quebrado só compra alguns meses.

Você procurou sobre %CF_TEMAS_BUSCADOS%. Vale rever o trecho com essa lente, olhando
para o processo e não para o indivíduo: %CF_LINK_TRECHO%

Abraço,
**Thiago Concer**
```

### E-mail 3 (3 dias depois)

**Assunto:** Previsibilidade não vem de meta
**Preheader:** Vem de saber onde a venda emperra

```
%FIRSTNAME%,

Meta agressiva não gera previsibilidade. Ela gera ansiedade no fim do mês e desconto
no dia 28.

Previsibilidade vem de conseguir responder três perguntas, com número, a qualquer
momento do mês:

1. Quantas conversas novas o time começou nesta semana?
2. De cada dez propostas enviadas, quantas viram venda?
3. Em qual etapa a maioria das vendas morre?

Se você não sabe responder alguma delas, esse é o buraco. Não é o vendedor, não é o
preço, não é o mercado.

E se souber responder a terceira, tem um atalho: descreve essa etapa no ConcerFinder
e recebe o que eu falo especificamente sobre ela, com a minutagem.

https://finder.thiagoconcer.com.br/busca

Abraço,
**Thiago Concer**
```

### E-mail 4 (4 dias depois)

**Assunto:** Quanto ficou na mesa no mês passado?
**Preheader:** Uma pergunta para o seu domingo

```
%FIRSTNAME%,

Uma conta rápida: pega quantas propostas sua empresa mandou no último mês e quantas
viraram venda. A diferença entre esses dois números, multiplicada pelo seu ticket
médio, é o dinheiro que ficou na mesa.

Na maioria das empresas esse número é maior que o custo do time comercial inteiro.

A boa notícia é que quase sempre ele se explica por duas ou três falhas repetidas, e
falha repetida é a coisa mais fácil de corrigir, porque é sempre a mesma.

Descreve onde você acha que está a falha e o ConcerFinder te mostra o que o Concer
fala sobre ela:

https://finder.thiagoconcer.com.br/busca

Você já fez %CF_TOTAL_BUSCAS% busca(s).

Abraço,
**Thiago Concer**
```

---

## Regras que você precisa respeitar ao montar

1. **Não crie tags nem campos novos.** Tudo já existe, use pelos nomes acima. Se algum campo não aparecer no seletor de personalização, procure pelo título (ex.: "CF Dor Principal"), não pela tag.
2. **Gatilho:** "Tag é adicionada", opção **"Executar uma vez"** por contato (não "várias vezes").
3. **Não coloque condição de lista.** O gatilho é a tag, e só.
4. **Confira o remetente em cada e-mail:** `Thiago Concer <time@thiagoconcer.com.br>`, responder para `suporte@anevedu.com.br`.
5. **Envie um teste** de cada e-mail 1 para `master@thiagoconcer.com.br` antes de ativar, e confirme que as tags de personalização foram substituídas e não aparecem como `%CF_...%` literal.
6. **Ative as três automações** ao terminar.

---

## O que me devolver (obrigatório)

Ao terminar, responda com este JSON preenchido. O Claude Code usa esses ids para
fechar a integração e para conferir se a régua está recebendo gente.

```json
{
  "status": "concluido",
  "automacoes": [
    {
      "perfil": "vendedor",
      "nome": "[CF] Nutrição ConcerFinder - Vendedor",
      "automation_id": "",
      "gatilho_tag": "concerfinder - vendedor",
      "ativa": true,
      "emails": [
        { "etapa": "d0", "assunto": "", "campaign_id": "", "espera_antes": "0 dias" },
        { "etapa": "d2", "assunto": "", "campaign_id": "", "espera_antes": "2 dias" },
        { "etapa": "d5", "assunto": "", "campaign_id": "", "espera_antes": "3 dias" },
        { "etapa": "d9", "assunto": "", "campaign_id": "", "espera_antes": "4 dias" }
      ]
    },
    { "perfil": "gestor", "nome": "[CF] Nutrição ConcerFinder - Gestor", "automation_id": "", "gatilho_tag": "concerfinder - gestor", "ativa": true, "emails": [] },
    { "perfil": "dono", "nome": "[CF] Nutrição ConcerFinder - Dono", "automation_id": "", "gatilho_tag": "concerfinder - dono", "ativa": true, "emails": [] }
  ],
  "remetente": {
    "from_name": "Thiago Concer",
    "from_email": "time@thiagoconcer.com.br",
    "reply_to": "suporte@anevedu.com.br",
    "confirmado_em_todos_os_emails": true
  },
  "teste_de_personalizacao": {
    "enviado_para": "master@thiagoconcer.com.br",
    "campos_substituidos_corretamente": true,
    "campos_que_falharam": []
  },
  "problemas_encontrados": [],
  "decisoes_que_precisei_tomar": []
}
```

**Onde achar o `automation_id`:** está na URL ao abrir a automação, no formato
`.../automation/manage/designer/<id>/...`.

**Se algo não for possível** exatamente como descrito, não invente solução silenciosa:
faça o mais próximo, e descreva em `decisoes_que_precisei_tomar` o que mudou e por quê.

---

# ATUALIZAÇÃO DE 20/08/2026: contexto da dor e convite do parceiro

Duas mudanças pedidas pelo Bruno depois que o produto ganhou a pergunta de contexto. **A copy abaixo substitui os blocos correspondentes nas campanhas do ActiveCampaign.**

## 1. O PS do E1 das três réguas

O produto mudou: depois de entregar os trechos, o ConcerFinder faz uma pergunta sobre a situação da pessoa e reescreve o plano em cima da resposta dela. O E1 descrevia o mecanismo antigo, e essa mudança é motivo concreto de voltar, que é o que a régua quer.

**Vendedor, E1:**
```
PS: mudou uma coisa lá dentro. Depois dos trechos ele te faz uma pergunta sobre a tua situação e reescreve o plano em cima da tua resposta, com o que fazer na próxima ligação. Se aparecer outra dor no meio da semana, volta lá e descreve. É de graça e ilimitado: https://finder.thiagoconcer.com.br/busca
```

**Gestor, E1:**
```
PS: mudou uma coisa lá dentro. Depois dos trechos ele te pergunta como o teu time trabalha hoje e reescreve o plano em cima da tua resposta: a rotina, o que cobrar e o que olhar na reunião de segunda. Cada vendedor seu também pode ter a conta dele, de graça: https://finder.thiagoconcer.com.br
```

**Dono, E1:**
```
PS: mudou uma coisa lá dentro. Depois dos trechos ele te pergunta como o teu comercial funciona hoje e reescreve o plano em cima da tua resposta. Volta lá quando a dor mudar, é de graça e ilimitado: https://finder.thiagoconcer.com.br/busca
```

## 2. Convite do Viver de IA nas réguas de gestor e dono, a partir do E2

**Decisão do Bruno em 20/08.** Muda a regra anterior, que mantinha o parceiro só dentro do plano de ação. O convite entra **apenas nas réguas de gestor e dono** e **apenas do E2 em diante**, ou seja, depois que a pessoa já recebeu conteúdo. A régua de vendedor não leva convite: o produto do parceiro é vendido para empresa, e mandar vendedor para o formulário seria mandá-lo para algo que não é dele.

**Formato, corrigido em 20/08 depois da primeira versão.** A primeira tentativa colocou o bloco em cinza e corpo menor, para ele parecer uma nota. Ficou apagado: o convite some no fim do e-mail e ninguém clica no que parece rodapé. O bloco agora tem **o mesmo peso visual do resto do e-mail**, e o link vira **botão**.

Regras de estilo, e elas valem para o e-mail inteiro, não só para este bloco:
- Fundo **transparente**, sem caixa cinza, sem bloco colorido atrás do texto.
- Fonte **#000000**, Arial, 18px, a mesma do corpo. Nada de cinza claro nem de corpo menor.
- **Link dentro do texto continua azul e sublinhado** (`#2E74E8`). O `#000000` é a cor do TEXTO; se o link também ficar preto, ele deixa de parecer clicável e some no parágrafo, que foi o que aconteceu na primeira aplicação da regra. O único texto que não é preto nem azul é o de dentro do botão, que é branco.
- O link é um **botão azul** (`#2E74E8`, texto branco), igual ao botão do site.
- Uma linha fina separando do resto (`border-top:1px solid #dddddd`), só para marcar que ali começa outro assunto.

O bloco continua no fim, depois da assinatura, e continua sendo o segundo assunto do e-mail: a chamada principal é voltar ao ConcerFinder. O que muda é que ele está legível.

**HTML do botão**, o mesmo nos seis, trocando só o texto:

```html
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:4px 0 18px 0"><tr><td bgcolor="#2E74E8" style="border-radius:6px"><a href="LINK_AQUI" style="display:inline-block;padding:14px 28px;font-family:Arial, Helvetica, sans-serif;font-size:17px;font-weight:bold;color:#FFFFFF;text-decoration:none">TEXTO DO BOTÃO</a></td></tr></table>
```

Regras da parceria valem inteiras: nada de preço, nada de "a IA substitui vendedor", "formação" e nunca "curso", nunca dizer que Thiago Concer e Viver de IA "se juntaram". Quantidade sempre como "dezenas de soluções prontas", nunca o número exato.

**O parceiro é citado pelo nome, como já acontece dentro do ConcerFinder.** No plano de ação a frase é "soluções prontas do Viver de IA, a plataforma de IA que Thiago Concer indica". No e-mail, que é escrito em primeira pessoa, ela vira **"o Viver de IA, a plataforma de IA que eu indico"**. Sem o nome, o convite manda a pessoa clicar num botão sem saber para onde vai, e quem chegar no formulário encontra uma marca que nunca foi apresentada.

Link (UTM próprio, para separar do convite que já existe dentro do plano):
`https://type.viverdeia.ai/new?utm_source=embaixador&utm_medium=email&utm_campaign=concer-finder&utm_term=concer`

**Gestor E2** (tema: treino e role play)
```
Uma nota prática: o passo que mais morre é o que depende de alguém repetindo a mesma coisa toda semana, e treino é o caso clássico. Hoje a IA já ouve as calls do time e devolve o que cada vendedor errou, sem você assistir a todas.

O Viver de IA, a plataforma de IA que eu indico, tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa.

[BOTÃO: Ver como isso encaixa no meu time]
```

**Gestor E3** (tema: reunião de segunda)
```
Uma nota prática: a reunião boa depende de dado atualizado, e é aí que ela emperra, porque preencher CRM é a tarefa que ninguém faz na sexta. A IA sustenta essa parte: o funil atualizado e o relatório pronto na segunda de manhã, sem você cobrar preenchimento.

O Viver de IA, a plataforma de IA que eu indico, tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa.

[BOTÃO: Ver como isso encaixa na minha rotina]
```

**Gestor E4** (tema: o que travou o time)
```
Uma nota prática: quando a mesma trava aparece toda semana, o problema deixou de ser diagnóstico e virou execução diária. A IA segura o que é repetitivo, o follow-up que ninguém faz, o cliente que esfria, o registro que não acontece, e devolve o seu tempo para o que exige gente.

O Viver de IA, a plataforma de IA que eu indico, tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa.

[BOTÃO: Ver como isso encaixa no meu time]
```

**Dono E2** (tema: comercial é sistema)
```
Uma nota prática, já que estamos falando de sistema: o passo que mais morre na segunda-feira é sempre o que depende de alguém repetindo a mesma tarefa todo dia, registrar, cobrar retorno, olhar o funil. É aí que a IA sustenta a rotina que a empresa não sustenta na mão.

O Viver de IA, a plataforma de IA que eu indico, tem dezenas de soluções prontas para isso, entregues montadas na conta da sua empresa.

[BOTÃO: Ver como isso encaixa no meu comercial]
```

**Dono E3** (tema: previsibilidade)
```
Uma nota prática: aquelas três perguntas só têm resposta se alguém registrar tudo, todo dia, e é exatamente aí que a empresa passa a depender de uma disciplina que ela não tem. A IA fecha esse buraco: funil atualizado e número na sua mão sem depender de cobrança.

O Viver de IA, a plataforma de IA que eu indico, tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa.

[BOTÃO: Ver como isso encaixa no meu comercial]
```

**Dono E4** (tema: o dinheiro que fica na mesa)
```
Uma nota prática: boa parte desse dinheiro some em tarefa simples e repetida, a proposta que não teve retorno, o cliente que ninguém lembrou de chamar. É o tipo de coisa que a IA faz sem esquecer e sem cansar.

O Viver de IA, a plataforma de IA que eu indico, tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa.

[BOTÃO: Ver o que dá para automatizar primeiro]
```

## 3. Nota de execução: o conector não grava corpo de e-mail

Tentado em 20/08 pelo conector do ActiveCampaign (`update_campaign_message`), nas mensagens 606 (E1 vendedor, já enviada) e 619 (E2 dono, nunca enviada): a chamada volta sem erro, mas **nada é gravado**. Conferido lendo de volta as duas: `mdate` não muda e o HTML continua o antigo. O mesmo teste com `subject` também não alterou `mdate`.

Então a aplicação desta copy é manual no editor do ActiveCampaign, ou por uma função com as credenciais que o produto já usa (as mesmas do `sync-nurture`). Não repetir a tentativa pelo conector esperando resultado diferente.


## 4. Correção de 20/08 à noite: o que já foi aplicado precisa ser refeito

Gestor E2 (campanha 283) e Gestor E3 (284) receberam o bloco na versão cinza e em corpo menor. Os dois precisam voltar com o estilo desta seção: texto #000000 em 18px, fundo transparente e botão azul. Os outros quatro (Gestor E4 285, Dono E2 287, Dono E3 288, Dono E4 289) ainda não têm o bloco e já entram no formato certo.

## 5. Rodada de correções de 20/08 à noite

O que a execução no ActiveCampaign devolveu, e o que fazer com cada coisa:

1. **Nome do parceiro no convite.** Os seis blocos foram aplicados com "a plataforma de IA que eu indico", sem citar Viver de IA. Precisa citar, pela regra acima.
2. **Link do corpo ficou preto.** A regra "fonte #000000" foi aplicada também aos links: o link do ConcerFinder no meio do parágrafo ficou preto sublinhado e deixou de parecer clicável. Link no corpo é azul `#2E74E8` sublinhado; `#000000` é a cor do texto.
3. **Terceira pessoa nos três E1.** Está "O Concer trata exatamente disso em..."; a régua é escrita em primeira pessoa e assinada por ele, então é "Eu trato exatamente disso em...". No Vendedor E1 também há "é o minuto onde ele responde a sua pergunta", que vira "eu respondo".
4. **Assinatura.** Uns assinam "Thiago Concer" e outros "Time do Thiago Concer". Como o texto inteiro fala em primeira pessoa ("eu trato", "eu indico"), a assinatura é **Thiago Concer** em negrito, nos doze.
5. **Assunto do Dono E4.** No ar está "Quanto ficou na mesa no mês passado?" e este documento pedia "A conta que vale a pena fazer". Fica o que está no ar, que é mais concreto, e o documento passa a registrar esse. **Corrigido aqui.**
6. **Nome interno das mensagens 615 e 619** diz "Vendedor" sendo Gestor E2 e Dono E2. É só rótulo interno, mas confunde na hora de procurar: renomear.
7. **`multientry=1` nas três automações.** O desenho é uma execução por contato. Com entrada múltipla, quem for re-tagueado recebe a régua inteira de novo, o que é grave numa base pequena. Conferir na tela do gatilho e deixar em execução única.

---

## 6. Template no celular: margem, hierarquia e rodapé

Conferido no Gmail do Android em 20/08. A maior parte da base lê pelo celular, e lá o e-mail estava assim: texto colado nas duas bordas da tela, tudo do mesmo tamanho e o rodapé tão grande quanto o corpo. Três correções no HTML do template, e elas valem para os doze e-mails.

**1. Margem lateral.** O `<td>` que envolve o texto está com `padding:0`. No desktop o e-mail tem 650px centrados e ninguém percebe; no celular a largura vira a da tela e a primeira letra encosta na borda. Esse `<td>` passa a ter `padding:0 24px`, e a regra de mobile reduz para 18px.

**2. Rodapé menor.** A causa não é o rodapé estar grande no desktop (lá ele é 14px), é uma regra do próprio template: dentro do `@media (max-width:600px)` existe `.es-footer-body p { font-size:16px!important }`, que **aumenta** o rodapé no celular até quase o tamanho do corpo. Trocar esse `16px` por `12px`. No desktop, deixar os parágrafos do rodapé em `font-size:12px;color:#666666`.

**3. Hierarquia.** O corpo continua em 18px (16px no celular, pela regra que já existe). O que dava a impressão de "tudo igual" era o rodapé inflado; resolvido o item 2, a escala fica corpo 18 > botão 17 > rodapé 12.

Além disso, duas metas no `<head>` para o cliente de e-mail saber que o design é claro, o que evita a inversão torta em modo escuro:

```html
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
```

Trechos exatos a mudar no `<style>` do template:

```css
/* dentro de @media only screen and (max-width:600px) */
.es-footer-body p, .es-footer-body ul li, .es-footer-body ol li, .es-footer-body a { font-size:12px!important }
.cf-corpo { padding-left:18px!important; padding-right:18px!important }
```

O `<td>` do conteúdo ganha `class="cf-corpo"` e `padding:0 24px`. A classe existe para a regra de mobile não pegar todos os `<td>` do e-mail, o que estragaria o botão e o rodapé.

### Referência de acabamento

O Bruno mandou como referência um e-mail da própria conta (as campanhas antigas do Thiago Concer, com os ícones sociais e o texto de missão no pé). É esse o padrão a alcançar, e ele resolve tudo o que está no item 6:

- margem lateral confortável, o texto nunca encosta na borda da tela;
- corpo em 16px no celular, com respiro entre parágrafos;
- **botão centralizado, largo, rótulo em CAIXA ALTA e negrito, com a seta `→` no fim**, cantos arredondados;
- assinatura "Thiago Concer" em negrito, e uma linha fina fechando a mensagem;
- rodapé em corpo pequeno e cinza, visivelmente menor que o texto, com os ícones sociais acima.

Botão no formato da referência:

```html
<table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:24px auto"><tr><td bgcolor="#2E74E8" align="center" style="border-radius:8px"><a href="LINK_AQUI" style="display:inline-block;padding:16px 32px;font-family:Arial, Helvetica, sans-serif;font-size:16px;font-weight:bold;letter-spacing:0.04em;color:#FFFFFF;text-decoration:none">RÓTULO EM CAIXA ALTA →</a></td></tr></table>
```

O rótulo vai escrito em maiúsculas no próprio texto, não por `text-transform`, que parte dos clientes ignora.

O rodapé com ícones sociais já existe nas campanhas antigas da conta: copiar o bloco de lá em vez de recriar, para os e-mails do ConcerFinder terminarem igual ao resto do que a conta manda.

## 7. Aplicado por API em 20/08 à noite

Os doze e-mails foram reconstruídos no template de `docs/nutricao/TEMPLATE-EMAIL.html` e gravados pela **API v3 do ActiveCampaign** (`PUT /api/3/messages/{id}` com `Api-Token`), não pelo conector MCP, que continua não gravando corpo. A copy veio do que já estava no ar, para não perder nenhuma revisão de texto; o que mudou foi a moldura e o estilo, mais quatro correções aplicadas no texto:

- o parceiro passou a ser citado pelo nome ("O Viver de IA, a plataforma de IA que eu indico");
- link do corpo voltou a ser azul (`#2660F5`) sublinhado, e o `#000000` ficou só no texto;
- terceira pessoa que sobrava virou primeira ("o que o Concer fala" → "o que eu falo");
- assinatura igual nos doze, "Thiago Concer" em negrito.

Conferido lendo os doze de volta: margem lateral, ícones sociais e rodapé de 12px nos doze; bloco do parceiro com botão apenas nos seis de gestor e dono; nenhuma terceira pessoa e nenhum link preto sobrando.

**O que não deu:** o envio de teste pela API v1 (`api_action=campaign_send&type=test`) responde "Você não tem nenhum endereço de correspondência" mesmo passando `addressid`. O teste continua sendo pelo botão "Testar e visualizar" do editor.

## 8. Template cartão, 20/08 à noite

O template de tabela antiga saiu de circulação. O novo, em `TEMPLATE-EMAIL.html`, é o do e-mail de diagnóstico que o Bruno aprovou: fundo `#F6F8FC`, cartão branco de cantos arredondados, marca no topo em azul, título de 28px, corpo 17px/1.7 em **`#000000`**, link `#1A5CCC` e botão `#2E74E8`.

O cinza-azulado da referência (`#41506A` no corpo, `#0C1726` nos pontos) foi vetado: **texto é preto, e a única cor no meio da leitura é o azul do link**. O que separa um trecho do outro é negrito e espaço, não tom de cinza. Cinza fica só no rodapé, que é onde ele quer dizer "isto aqui é aviso legal, não é a mensagem".

Três mudanças de estrutura vieram junto, e valem para os doze:

1. **O assunto virou o título do e-mail.** Antes todo e-mail começava em "%FIRSTNAME%," e seguia tudo do mesmo tamanho, sem ponto de entrada.
2. **Parágrafo que era só uma URL virou botão.** O link solto no meio do texto era a forma mais fácil de o CTA passar batido. Rótulo por régua: "Descrever minha dor de vendas", "Descrever a dor da minha gestão", "Descrever a dor do meu comercial".
3. **A assinatura saiu do corpo** e virou o rodapé do cartão, igual nos doze.

A margem lateral agora vem de fora do cartão, então no celular o texto não encosta na borda em nenhuma largura.

**Atenção a duas mãos escrevendo.** Em 20/08 uma sessão paralela gravou por cima do Vendedor E1 dez minutos depois de eu ter aplicado o template, e o e-mail voltou ao formato antigo. Enquanto alguém estiver editando pelo editor, as duas versões brigam. Combinado: as alterações saem por API, com leitura de volta para conferir.
