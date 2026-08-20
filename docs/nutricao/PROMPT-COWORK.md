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

**Assunto:** A conta que vale a pena fazer
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

Formato: um bloco curto no fim do e-mail, depois da assinatura, separado por linha, em corpo menor e cinza. Ele é uma nota, não a chamada principal do e-mail, porque a chamada principal continua sendo voltar ao ConcerFinder.

Regras da parceria valem inteiras: nada de preço, nada de "a IA substitui vendedor", "formação" e nunca "curso", nunca dizer que Thiago Concer e Viver de IA "se juntaram", e a expressão é **"a plataforma de IA que eu indico"**. Quantidade sempre como "dezenas de soluções prontas", nunca o número exato.

Link (UTM próprio, para separar do convite que já existe dentro do plano):
`https://type.viverdeia.ai/new?utm_source=embaixador&utm_medium=email&utm_campaign=concer-finder&utm_term=concer`

**Gestor E2** (tema: treino e role play)
```
Uma nota prática: o passo que mais morre é o que depende de alguém repetindo a mesma coisa toda semana, e treino é o caso clássico. Hoje a IA já ouve as calls do time e devolve o que cada vendedor errou, sem você assistir a todas.

A plataforma de IA que eu indico tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa. Ver como isso encaixa no seu time: [LINK]
```

**Gestor E3** (tema: reunião de segunda)
```
Uma nota prática: a reunião boa depende de dado atualizado, e é aí que ela emperra, porque preencher CRM é a tarefa que ninguém faz na sexta. A IA sustenta essa parte: o funil atualizado e o relatório pronto na segunda de manhã, sem você cobrar preenchimento.

A plataforma de IA que eu indico tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa. Ver como isso encaixa na sua rotina: [LINK]
```

**Gestor E4** (tema: o que travou o time)
```
Uma nota prática: quando a mesma trava aparece toda semana, o problema deixou de ser diagnóstico e virou execução diária. A IA segura o que é repetitivo, o follow-up que ninguém faz, o cliente que esfria, o registro que não acontece, e devolve o seu tempo para o que exige gente.

A plataforma de IA que eu indico tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa. Ver como isso encaixa no seu time: [LINK]
```

**Dono E2** (tema: comercial é sistema)
```
Uma nota prática, já que estamos falando de sistema: o passo que mais morre na segunda-feira é sempre o que depende de alguém repetindo a mesma tarefa todo dia, registrar, cobrar retorno, olhar o funil. É aí que a IA sustenta a rotina que a empresa não sustenta na mão.

A plataforma de IA que eu indico tem dezenas de soluções prontas para isso, entregues montadas na conta da sua empresa. Ver como isso encaixa no seu comercial: [LINK]
```

**Dono E3** (tema: previsibilidade)
```
Uma nota prática: aquelas três perguntas só têm resposta se alguém registrar tudo, todo dia, e é exatamente aí que a empresa passa a depender de uma disciplina que ela não tem. A IA fecha esse buraco: funil atualizado e número na sua mão sem depender de cobrança.

A plataforma de IA que eu indico tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa. Ver como isso encaixa no seu comercial: [LINK]
```

**Dono E4** (tema: o dinheiro que fica na mesa)
```
Uma nota prática: boa parte desse dinheiro some em tarefa simples e repetida, a proposta que não teve retorno, o cliente que ninguém lembrou de chamar. É o tipo de coisa que a IA faz sem esquecer e sem cansar.

A plataforma de IA que eu indico tem dezenas de soluções prontas assim, entregues montadas na conta da sua empresa. Ver o que dá para automatizar primeiro: [LINK]
```

## 3. Nota de execução: o conector não grava corpo de e-mail

Tentado em 20/08 pelo conector do ActiveCampaign (`update_campaign_message`), nas mensagens 606 (E1 vendedor, já enviada) e 619 (E2 dono, nunca enviada): a chamada volta sem erro, mas **nada é gravado**. Conferido lendo de volta as duas: `mdate` não muda e o HTML continua o antigo. O mesmo teste com `subject` também não alterou `mdate`.

Então a aplicação desta copy é manual no editor do ActiveCampaign, ou por uma função com as credenciais que o produto já usa (as mesmas do `sync-nurture`). Não repetir a tentativa pelo conector esperando resultado diferente.
