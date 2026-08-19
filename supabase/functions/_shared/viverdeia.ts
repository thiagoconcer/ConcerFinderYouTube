/**
 * Soluções do Viver de IA, para o plano de ação terminar dizendo como a IA
 * acelera aquilo que o Concer acabou de mandar fazer.
 *
 * POR QUE UMA LISTA FECHADA. O modelo escreve o texto, mas não escolhe o que
 * existe: sem uma lista, ele inventaria uma solução plausível que o parceiro
 * não tem, e a pessoa cairia no formulário procurando uma coisa que ninguém
 * vende. As famílias abaixo saem do catálogo real (`app.viverdeia.ai/solucoes`,
 * levantado em 18/08/2026), agrupadas por DOR e não por produto, porque é por
 * dor que a busca chega aqui.
 *
 * A régua editorial vem do documento "Por que Thiago Concer e Viver de IA se
 * juntaram". Ela não é preferência de estilo, é o que a casa já decidiu que
 * pode e não pode ser dito sobre a parceria, e vale igual aqui dentro.
 */

export const CTA_VIVERDEIA_URL =
  'https://type.viverdeia.ai/new?utm_source=embaixador&utm_medium=plano-de-acao&utm_campaign=concer-finder&utm_term=concer'

/**
 * Perfis que recebem o convite para a conversa.
 *
 * O documento da parceria é explícito: o produto do parceiro é B2B, vendido
 * para empresa, e o vendedor "não é alvo das peças que convidam para a aula e
 * levam à oferta". Ele continua recebendo o conteúdo de como usar IA no dia a
 * dia dele, que é a seção inteira, só não recebe o botão que leva ao
 * formulário. Mandar vendedor autônomo para um diagnóstico B2B queima o lead
 * dos dois lados: ele perde tempo e o parceiro recebe cadastro fora do perfil.
 *
 * Para abrir o botão a todo mundo, é só acrescentar 'vendedor' aqui.
 */
export const PERFIS_COM_CTA = ['dono_empresa', 'gestor_comercial']

/**
 * Famílias de solução. O modelo escolhe UMA ou DUAS, pelo encaixe com a dor.
 * `quando` é o gatilho que ele lê; `o_que_faz` é o que ele pode afirmar.
 */
export const SOLUCOES_VIVERDEIA = [
  {
    familia: 'Atendimento do lead no minuto em que ele chega',
    quando: 'o lead esfria esperando resposta, chega fora do horário, ou ninguém retorna a tempo',
    o_que_faz:
      'uma vendedora de IA que responde no WhatsApp assim que o contato entra, faz as primeiras perguntas e passa para o vendedor já com contexto, inclusive de madrugada e no fim de semana',
    exemplo: 'Nina',
    exemplo_faz: 'vendedora de IA que atende e qualifica no WhatsApp a qualquer hora e agenda a reunião direto no calendário do time',
  },
  {
    familia: 'Qualificação e follow-up em volume',
    quando: 'a dor é lead ruim, funil entupido, ou follow-up que ninguém faz',
    o_que_faz:
      'qualificar cada lead que entra por critério fixo e manter a cadência de retomada de contato sem depender da memória de ninguém',
    exemplo: 'Nina',
    exemplo_faz: 'vendedora de IA que conversa com cada lead que entra, qualifica pelo perfil ideal e agenda a reunião, inclusive no volume que o time humano não dá conta',
  },
  {
    familia: 'Prospecção ativa',
    quando: 'a dor é funil vazio, poucos contatos novos, ou lista fria parada',
    o_que_faz:
      'montar e trabalhar lista de prospecção com a abordagem personalizada por contato, em vez de o vendedor garimpar um por um',
    exemplo: 'Prospecta AI',
    exemplo_faz: 'monta listas segmentadas com telefone, e-mail e o tomador de decisão de cada empresa, a partir dos parâmetros que você define',
  },
  {
    familia: 'Treino diário com o erro real do time',
    quando: 'a dor é treino que não pega, time que volta ao antigo, ou vendedor novo sem padrão',
    o_que_faz:
      'roleplay com pauta gerada a partir das calls reais do dia anterior, para treinar o erro que aquele vendedor cometeu e não um tema genérico',
    exemplo: 'Roleplay de Vendas com IA',
    exemplo_faz: 'simula conversa real de cliente no WhatsApp para o time praticar objeção, negociação e fechamento, com ranking e acompanhamento de desempenho',
  },
  {
    familia: 'Análise de call e coaching',
    quando: 'a dor é não saber onde a venda morreu, ou não ter tempo de ouvir gravação',
    o_que_faz:
      'analisar as conversas e apontar em que etapa a venda caiu, com o trecho exato, sem o gestor precisar ouvir tudo',
    exemplo: 'LiveCoach',
    exemplo_faz: 'acompanha a reunião e dá a dica em tempo real para o vendedor, treinado com o playbook da sua empresa',
  },
  {
    familia: 'Processo comercial e script padrão',
    quando: 'a dor é falta de método, cada um vende de um jeito, ou processo só na cabeça de duas pessoas',
    o_que_faz:
      'estruturar as etapas do funil e o script de cada uma, e garantir que o time siga mesmo sob pressão na hora da objeção',
    exemplo: 'Playbook AI',
    exemplo_faz: 'monta o playbook comercial inteiro a partir das suas respostas, com funil, scripts e banco de objeções, e confere nas reuniões reais se o time está seguindo',
  },
  {
    familia: 'Indicador e previsibilidade',
    quando: 'a dor é descobrir que o mês foi ruim quando o mês acabou, ou gestão por achismo',
    o_que_faz:
      'relatório diário do que aconteceu no comercial e projeção de meta, para corrigir dentro do mês e não depois dele',
    exemplo: 'Relatório Diário de Vendas',
    exemplo_faz: 'puxa os dados do CRM e manda o resumo do dia no WhatsApp ou no Slack, sem ninguém abrir relatório',
  },
  {
    familia: 'Proposta e negociação',
    quando: 'a dor é proposta que some, cliente que não responde depois do orçamento, ou desconto dado cedo demais',
    o_que_faz:
      'gerar a proposta e acompanhar se o cliente abriu, para a retomada acontecer na hora certa e com argumento',
    exemplo: 'Gerador de Propostas com Tracking',
    exemplo_faz: 'monta a proposta e mostra quanto tempo o cliente passou em cada parte dela, para a retomada acontecer na hora certa',
  },
] as const

/**
 * O pedaço de prompt que ensina o modelo a escrever a seção.
 *
 * As proibições não são capricho: cada uma sai da lista "O que não passa" do
 * documento da parceria. Contar quantas soluções existem, prometer resultado,
 * falar em preço ou dizer que a IA substitui gente são exatamente os erros que
 * a casa já decidiu que não comete.
 */
export function instrucaoDaSecaoIA(): string {
  const catalogo = SOLUCOES_VIVERDEIA.map(
    (s) =>
      `- ${s.familia}: use quando ${s.quando}. Faz: ${s.o_que_faz}. ` +
      `Solução pronta que faz isso: ${s.exemplo}, que ${s.exemplo_faz}.`,
  ).join('\n')

  return `## Como a IA acelera isso
Dois parágrafos curtos, no máximo cinco frases no total.

O primeiro diz qual PARTE ESPECÍFICA do plano acima é braçal e diária, e por isso morre na segunda-feira: manter a cadência com todo mundo, treinar cada vendedor com o erro dele, ouvir call, qualificar cada lead. Nomeie o passo, não fale de execução em abstrato.

O segundo diz o que existe hoje de IA para sustentar exatamente aquilo. Escolha UMA ou no máximo DUAS famílias desta lista fechada e CITE PELO NOME a solução pronta correspondente, dizendo em poucas palavras o que ela faz. Nome de produto é mais concreto que categoria: "o LiveCoach acompanha a reunião e dá a dica na hora" diz mais do que "existem soluções de análise de call". Feche o parágrafo deixando claro que a solução chega PRONTA para plugar na operação, não é projeto para desenvolver do zero.

${catalogo}

Regras desta seção, todas obrigatórias:
- Escolha só desta lista. Não invente solução, nome de produto, integração ou funcionalidade que não esteja aqui.
- Se precisar falar do conjunto, diga "mais de 150 soluções prontas". Nunca um número exato: o catálogo
  cresce toda semana e número exato envelhece dentro do plano, que fica gravado.
- Nunca escreva que Thiago Concer e Viver de IA "se juntaram", "fecharam parceria" ou variação. A relação
  não é o assunto da seção; o assunto é o que resolve a dor da pessoa. Se precisar nomear, "a plataforma
  que Thiago Concer indica" basta. Nunca escreva só "Concer" ou "o Thiago": é sempre "Thiago Concer".
- Nunca escreva que a IA substitui vendedor, que sai mais barato que gente ou que a empresa não precisa contratar. O enquadramento é sempre ampliar a capacidade de quem já está lá.
- A IA não cria processo que não existe, não cria disciplina e não decide pelo dono. Se o plano acima é sobre criar uma rotina que ainda não existe, diga que a IA sustenta a rotina depois que ela for decidida, não que ela resolve sozinha.
- Chame de "vendedora de IA" ou "IA de prospecção". Nunca use a sigla de pré-venda.
- Diga "formação", nunca "curso".
- Sem preço, sem promessa de resultado, sem número, sem nome de cliente, sem case.
- Proibidas as palavras: transforme, potencializar, revolucionar, acesso vitalício.
- Sem travessão, sem emoji, sem hashtag.
- Não escreva chamada para ação, não convide para conversa e não cite link: a tela cuida disso. Termine no conteúdo.

Depois do segundo parágrafo, numa linha sozinha, escreva exatamente:
[[solucao: NOME]]
trocando NOME pelo nome da solução PRINCIPAL que você citou, escrito igual à lista (por exemplo [[solucao: LiveCoach]]). Essa linha não é texto para a pessoa ler, é o que faz a tela montar o convite falando da mesma solução que você acabou de citar. Sem ela o convite sai genérico e joga fora a especificidade que você construiu.`
}
