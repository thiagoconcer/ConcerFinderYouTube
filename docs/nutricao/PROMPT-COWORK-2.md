# Continuação: terminar a régua de nutrição do ConcerFinder no ActiveCampaign

> Esta é a **continuação** de um trabalho já começado em outra sessão. Uma parte
> já está pronta na conta e **não deve ser refeita**. Leia "O que já existe"
> antes de tocar em qualquer coisa.

## Se a sessão do ActiveCampaign cair

Acontece de vez em quando. **Só clicar em "Login"**: a senha está salva no
navegador e a sessão volta sozinha. Não precisa pedir credencial a ninguém.

Conta: `https://thiagoconcer56558.activehosted.com`

---

## Contexto

O **ConcerFinder** (`https://finder.thiagoconcer.com.br`) é uma busca semântica
sobre os vídeos do canal do Thiago Concer. A pessoa descreve uma dor de vendas em
linguagem natural e recebe quais vídeos assistir, **o minuto exato** de cada
insight e um plano de ação.

O cadastro é obrigatório, e é ele que gera o lead. A régua de nutrição é o que
transforma esse cadastro em relacionamento.

**O que torna esta régua diferente de qualquer outra:** o primeiro e-mail cita a
dor que a pessoa escreveu, com as palavras dela, e entrega o minuto exato do
vídeo que responde. Isso vem de campos personalizados que o aplicativo grava no
contato **antes** de aplicar a tag que dispara a automação.

São três réguas, uma por perfil, porque o mesmo conteúdo não serve para quem
vende, para quem lidera quem vende e para quem é dono do negócio.

---

## O que já existe (NÃO criar de novo)

### Campos personalizados (já criados e já sendo preenchidos pelo app)

| Tag de personalização | O que contém |
|---|---|
| `%CF_DOR_PRINCIPAL%` | A dor que a pessoa escreveu, com as palavras dela |
| `%CF_VIDEO_RECOMENDADO%` | Título do vídeo mais relevante |
| `%CF_MINUTAGEM%` | Minuto exato do trecho, ex.: "1:01:33" |
| `%CF_LINK_TRECHO%` | Link direto do trecho já no minuto certo |
| `%CF_TEMAS_BUSCADOS%` | Temas detectados, ex.: "Objeção de preço, Gestão de equipe" |
| `%CF_TOTAL_BUSCAS%` | Quantas buscas a pessoa já fez |
| `%CF_PERFIL_COMERCIAL%` | Vendedor / Gestor comercial / Dono de empresa |
| `%CARGO_NEWSLETTER%` | Cargo declarado no cadastro |

Os nativos `%FIRSTNAME%`, `%EMAIL%` e `%UNSUBSCRIBELINK%` também estão em uso.

### Tags (todas já criadas)

| id | Tag | Papel |
|---|---|---|
| 196 | `concerfinder - vendedor` | **gatilho** da automação 1 |
| 197 | `concerfinder - gestor` | **gatilho** da automação 2 |
| 198 | `concerfinder - dono` | **gatilho** da automação 3 |
| 199 | `concerfinder - regua d0` | marca que recebeu o e-mail 1 |
| 200 | `concerfinder - regua d2` | marca que recebeu o e-mail 2 |
| 201 | `concerfinder - regua d5` | marca que recebeu o e-mail 3 |
| 202 | `concerfinder - regua d9` | marca que recebeu o e-mail 4 |
| 195 | `concerfinder - lead` | aplicada no cadastro |
| 70 | `newsletter gestores e donos` | aplicada no cadastro |

As tags de etapa (`regua dX`) são **compartilhadas pelas três réguas**. Isso é
proposital: a tag de gatilho já diz em qual fluxo a pessoa está, então não
precisa duplicar.

### Automação 1 (parcialmente construída)

**`[CF] Nutrição ConcerFinder - Vendedor`**, automation_id **18**, ainda inativa.

Gatilho já configurado e conferido: tag `concerfinder - vendedor`, executa uma
vez, sem condição de lista.

Blocos já montados, nesta ordem:

1. E1 (campanha 270, mensagem 606) — "Achei o minuto exato, %FIRSTNAME%"
2. Aplica tag `concerfinder - regua d0`
3. Espera 2 dias
4. E2 (campanha 272, mensagem 607) — "A venda não se perde no fechamento"
5. Aplica tag `concerfinder - regua d2`
6. Espera 3 dias
7. E3 (campanha 274, mensagem 608) — "Como treinar sem depender do seu gestor"

Já conferido por fora, está tudo certo nesses três: remetente, resposta,
domínio novo e todas as tags de personalização válidas.

---

## Padrão visual, vale para TODOS os e-mails

- Fonte **Arial**, tamanho **18px**, cor **`#000000`**, entrelinha **1,55**
- **Negrito só nos destaques**, nunca em parágrafo inteiro
- Texto simples, **sem template gráfico**, sem imagem, sem botão colorido
- Rodapé padrão da conta, com link de descadastro
- Remetente: **Thiago Concer** `<time@thiagoconcer.com.br>`
- Responder para: **suporte@anevedu.com.br**
- Nome da campanha no padrão já usado: `[CF] <Perfil> - E<n> D<dia> - <resumo>`

---

## TAREFA 0 (correção rápida, faça primeiro)

A mensagem **608** (E3 do vendedor, "Como treinar sem depender do seu gestor")
ficou **sem nenhum negrito**. O E1 tem 2 destaques e o E2 tem 4; esse ficou com 0.

Abra a mensagem 608 e aplique negrito nos trechos que carregam a ideia central,
no mesmo critério dos outros dois. Não reescreva o texto, só destaque.

---

## TAREFA 1: terminar a automação do Vendedor (id 18)

Continuando de onde parou, acrescente ao fim do fluxo:

1. Aplica tag `concerfinder - regua d5`
2. Espera **4 dias**
3. Envia o **E4** (copy abaixo)
4. Aplica tag `concerfinder - regua d9`

### E4 do Vendedor (dia 9)

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
Time do Thiago Concer
```

---

## TAREFA 2: criar a automação do Gestor

**Nome:** `[CF] Nutrição ConcerFinder - Gestor`
**Gatilho:** tag `concerfinder - gestor`, executa uma vez, sem condição de lista

**Estrutura:** E1, tag `regua d0`, espera 2 dias, E2, tag `regua d2`, espera 3
dias, E3, tag `regua d5`, espera 4 dias, E4, tag `regua d9`.

### E1 (imediato)

**Assunto:** Achei o minuto exato, %FIRSTNAME%
**Preheader:** Sobre o que você procurou no ConcerFinder

```
%FIRSTNAME%, você entrou no ConcerFinder procurando isto:

"%CF_DOR_PRINCIPAL%"

O Concer trata exatamente disso em "%CF_VIDEO_RECOMENDADO%", no minuto %CF_MINUTAGEM%.

Assista esse trecho: %CF_LINK_TRECHO%

Sugestão de gestor: não assista sozinho. Leve esse trecho para a reunião de segunda
e passe os quatro minutos com o time. Discussão em cima de um trecho curto rende
mais que treinamento de duas horas, porque todo mundo viu a mesma coisa.

Nos próximos dias eu mando mais cortes sobre esse tema, sempre com a minutagem.

Abraço,
Time do Thiago Concer

PS: cada vendedor seu pode ter a conta dele e buscar as próprias dores.
É de graça: https://finder.thiagoconcer.com.br
```

### E2 (2 dias depois)

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
Time do Thiago Concer
```

### E3 (3 dias depois)

**Assunto:** A reunião de segunda que muda o mês
**Preheader:** Sem PowerPoint, sem discurso motivacional

```
%FIRSTNAME%,

A maior parte das reuniões de segunda é leitura de número em voz alta. Todo mundo
já viu o número no CRM. O que ninguém treinou é o que fazer diferente na terça.

Uma estrutura que funciona:

1. Cinco minutos de número, e só. Sem discussão sobre o passado.
2. Uma dor real da semana, trazida por um vendedor. Real, com nome de cliente.
3. Um trecho do Concer sobre essa dor, com a minutagem, buscada no ConcerFinder.
4. Role play em cima do trecho.
5. Um combinado prático para a semana, escrito e visível.

O passo 3 é onde o ConcerFinder entra: você descreve a dor que o vendedor trouxe e
recebe o trecho pronto, no minuto certo. Sem você precisar lembrar em qual vídeo
estava, nem garimpar o canal na noite de domingo.

Preparar minha próxima reunião: https://finder.thiagoconcer.com.br/busca

Abraço,
Time do Thiago Concer
```

### E4 (4 dias depois)

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
Time do Thiago Concer
```

---

## TAREFA 3: criar a automação do Dono

**Nome:** `[CF] Nutrição ConcerFinder - Dono`
**Gatilho:** tag `concerfinder - dono`, executa uma vez, sem condição de lista

**Estrutura:** idêntica às outras (E1, d0, 2 dias, E2, d2, 3 dias, E3, d5, 4
dias, E4, d9).

### E1 (imediato)

**Assunto:** Achei o minuto exato, %FIRSTNAME%
**Preheader:** Sobre o que você procurou no ConcerFinder

```
%FIRSTNAME%, você entrou no ConcerFinder procurando isto:

"%CF_DOR_PRINCIPAL%"

O Concer trata exatamente disso em "%CF_VIDEO_RECOMENDADO%", no minuto %CF_MINUTAGEM%.

Assista esse trecho: %CF_LINK_TRECHO%

São quatro minutos. Como dono, o melhor uso desse trecho não é você assistir e
guardar: é mandar para quem lidera o comercial e cobrar o que vai mudar na prática
por causa dele.

Nos próximos dias eu mando mais alguns cortes sobre esse tema.

Abraço,
Time do Thiago Concer

PS: o acesso é gratuito e ilimitado. Vale colocar seu time comercial inteiro lá:
https://finder.thiagoconcer.com.br
```

### E2 (2 dias depois)

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
Time do Thiago Concer
```

### E3 (3 dias depois)

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
e recebe o que o Concer fala especificamente sobre ela, com a minutagem.

https://finder.thiagoconcer.com.br/busca

Abraço,
Time do Thiago Concer
```

### E4 (4 dias depois)

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
Time do Thiago Concer
```

---

## TAREFA 4: teste e ativação (só no fim)

1. Envie um teste do **E1 de cada régua** para `master@thiagoconcer.com.br`.
2. Confira no teste: remetente, resposta, links apontando para
   `finder.thiagoconcer.com.br`, corpo em 18px `#000000`.
3. **Ative as três automações.**

> **Aviso sobre o teste.** No envio de teste, os campos `%CF_...%` podem sair
> vazios ou com o nome da tag. **Isso não é defeito da automação**: é o contato
> de teste que não tem esses campos preenchidos, porque eles só são gravados
> quando a pessoa faz uma busca no ConcerFinder. Não tente "consertar" o e-mail
> por causa disso, e não substitua a tag por texto fixo. Se o campo aparecer
> vazio no teste, reporte e siga.

---

## Regras que você precisa respeitar

- **Não crie tags nem campos personalizados novos.** Todos já existem, na lista
  acima. Se sentir falta de algum, reporte em vez de criar.
- **Não altere as automações, campanhas ou mensagens já prontas**, exceto a
  correção de negrito da mensagem 608 pedida na Tarefa 0.
- **Copie o texto exatamente como está.** Ele foi escrito para esse público; não
  reescreva, não "melhore", não acrescente emoji.
- **Não mexa em nenhuma automação fora do ConcerFinder.** A conta tem réguas
  antigas em produção.
- **Ative as automações só na Tarefa 4**, nunca antes, para ninguém entrar em um
  fluxo pela metade.
- Se algo na interface não permitir o que foi pedido, **reporte em vez de
  improvisar**. Uma decisão sua que eu não sei que foi tomada é pior que um
  passo faltando.

---

## O que me devolver (obrigatório)

Um JSON com este formato, além do relato em texto:

```json
{
  "status": "concluido | parcial",
  "correcao_608": { "negritos_aplicados": 0, "ok": true },
  "automacoes": [
    {
      "perfil": "vendedor | gestor | dono",
      "automation_id": "",
      "nome": "",
      "tag_gatilho": "",
      "ativa": true,
      "campanhas": [
        { "etapa": "d0|d2|d5|d9", "campaign_id": "", "message_id": "", "assunto": "" }
      ],
      "esperas": ["2 dias", "3 dias", "4 dias"],
      "tags_de_etapa": ["concerfinder - regua d0", "..."]
    }
  ],
  "teste_enviado_para": "master@thiagoconcer.com.br",
  "campos_vazios_no_teste": ["lista das tags %CF_% que sairam vazias, se houver"],
  "problemas_encontrados": [],
  "decisoes_que_precisei_tomar": []
}
```
