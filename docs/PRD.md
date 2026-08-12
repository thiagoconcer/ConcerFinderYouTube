## 1. Contexto

O **ConcerFinder** nasce para resolver um problema concreto de acesso a conhecimento: o canal do Thiago Concer — a maior referência em vendas do Brasil — reúne centenas de vídeos, mas o público (vendedores, gestores comerciais e donos de empresa) não sabe em qual vídeo nem em qual minuto está o insight que precisa. Como você descreveu, a busca por palavra-chave do YouTube "deixa passar muitas coisas que estão no meio do vídeo". O ConcerFinder transforma todo esse acervo em uma base pesquisável por **dor e por tema em linguagem natural**, devolvendo os vídeos certos, a minutagem exata do insight e um plano de ação. Como o acesso exige cadastro, cada uso gera um lead qualificado, nutrido automaticamente por e-mail e WhatsApp, formando uma audiência segmentada por interesse de vendas — base do modelo de receita descrito (cobrar de empresas parceiras que queiram alcançar esse público).

## 2. Problema

O conteúdo do canal do Concer está disperso em centenas de vídeos e, nas suas palavras, "as pessoas não sabem especificamente onde estão os insights que elas precisam". A busca por palavra-chave existente é rasa: "só isso deixa passar muitas coisas que estão no meio do vídeo". Quem tem uma dor concreta de vendas — "meu time não consegue contornar a objeção de preço" ou "não sei como estruturar meu processo de prospecção" — não tem como localizar o trecho exato em que o Concer trata daquilo. Além disso, você apontou uma segunda dor: hoje o YouTube não entrega **quem** se interessa por cada tema, **qual dor** levou a pessoa até ali, nem permite conduzir esse público a outros vídeos relacionados. Sem esses dados, não é possível segmentar a audiência nem viabilizar as parcerias com empresas que precisam alcançá-la.

## 3. Objetivos

1. **Reduzir o tempo até o insight:** permitir que qualquer usuário descreva uma dor em linguagem natural e receba, em uma única busca, os vídeos e minutagens exatas relevantes — meta de retorno útil em ≤ 5 segundos por busca.
2. **Cobertura total do acervo:** indexar 100% dos vídeos públicos do canal do Concer e incorporar novos vídeos automaticamente em até 24h da publicação.
3. **Gerar leads qualificados:** converter todo acesso à busca em cadastro (nome, e-mail, WhatsApp, perfil comercial) e disparar a régua de nutrição automaticamente em 100% dos cadastros concluídos.
4. **Alimentar a segmentação de audiência:** registrar cada dor/tema buscada e associá-la ao perfil do usuário, produzindo um painel de temas mais buscados por perfil comercial.
5. **Entregar plano de ação:** anexar a cada resultado de busca um plano de ação derivado dos próprios insights dos vídeos recomendados.

## 4. Personas

**Rafael, o Vendedor (Usuário cadastrado)**
- Papel: vendedor de campo buscando melhorar performance individual.
- Dor: trava em objeções e não sabe onde o Concer ensina a contorná-las.
- Objetivo: achar rápido o trecho certo do vídeo e um passo a passo aplicável hoje.
- Citação: "meu time não consegue contornar a objeção de preço."

**Camila, a Gestora Comercial (Usuário cadastrado)**
- Papel: lidera um time de vendas e estrutura processos.
- Dor: precisa de referências específicas para treinar o time, não de horas de vídeo.
- Objetivo: montar trilhas de conteúdo por tema para o time.
- Citação: "não sei como estruturar meu processo de prospecção."

**Eduardo, o Dono de Empresa (Usuário cadastrado / Visitante)**
- Papel: empreendedor que quer elevar as vendas do negócio.
- Dor: tem pouco tempo e não quer garimpar centenas de vídeos.
- Objetivo: descrever a dor e receber o insight organizado com plano de ação.
- Citação: "todas as pessoas que têm interesse em vendas... donos de empresa."

**Marina, a Administradora de Conteúdo (Equipe Concer)**
- Papel: garante que a base de vídeos esteja completa, transcrita e indexada.
- Dor: precisa confirmar que novos vídeos entraram e que as recomendações têm qualidade.
- Objetivo: monitorar scraping/transcrição/indexação e sinalizar trechos para revisão.
- Citação: "confirma que eles foram capturados, transcritos e indexados para a busca."

**Thiago, o Gestor de Audiência/Comercial (Equipe Concer)**
- Papel: transforma os dados de dores e interesses em audiência segmentada.
- Dor: hoje não sabe qual dor levou cada pessoa até o conteúdo.
- Objetivo: segmentar por perfil/tema e viabilizar parcerias com empresas.
- Citação: "conseguimos entrar em contato com empresas que precisam da nossa audiência e cobrar por vídeos que levem até eles."

## 5. Requisitos funcionais

- **RF-01:** O sistema deve permitir que o visitante acesse uma tela de apresentação explicando que pode descrever qualquer dor de vendas e encontrar onde o Concer fala sobre isso.
- **RF-02:** O sistema deve permitir que o visitante se cadastre informando nome, e-mail, WhatsApp e perfil comercial (vendedor, gestor comercial ou dono de empresa).
- **RF-03:** O sistema deve permitir que o visitante conclua o cadastro por e-mail/senha ou magic link e seja imediatamente liberado como usuário cadastrado.
- **RF-04:** O sistema deve gerar automaticamente um lead a cada cadastro concluído e inseri-lo na régua de nutrição com status inicial pendente.
- **RF-05:** O sistema deve disparar automaticamente a nutrição por e-mail (ActiveCampaign) e WhatsApp pós-cadastro via webhook de nutrição existente e registrar o status de envio.
- **RF-06:** O sistema deve impedir que visitantes não cadastrados vejam qualquer resultado de recomendação.
- **RF-07:** O sistema deve permitir que o usuário cadastrado descreva, em linguagem natural, a dor ou dúvida de vendas em uma caixa de busca.
- **RF-08:** O sistema deve interpretar o significado da descrição (busca semântica), e não apenas correspondência de palavra-chave, para localizar os trechos mais relevantes.
- **RF-09:** O sistema deve retornar uma lista de recomendações contendo o vídeo, a minutagem exata do insight e o score de relevância, ordenados por ranking.
- **RF-10:** O sistema deve gerar e exibir um plano de ação derivado dos insights dos vídeos recomendados para a dor descrita.
- **RF-11:** O sistema deve permitir que o usuário cadastrado clique em uma recomendação e seja levado diretamente ao vídeo no minuto indicado (deep-link com timestamp).
- **RF-12:** O sistema deve permitir que o usuário cadastrado refine a busca, descreva novas dores e explore vídeos relacionados ao mesmo tema.
- **RF-13:** O sistema deve permitir que o usuário cadastrado consulte o histórico das próprias buscas.
- **RF-14:** O sistema deve permitir buscas ilimitadas por usuário cadastrado.
- **RF-15:** O sistema deve registrar cada dor/tema buscada e associá-la ao perfil do usuário para alimentar a segmentação de audiência.
- **RF-16:** O sistema deve fazer scraping automatizado da lista e metadados dos vídeos do canal do Concer via YouTube Data API (com Apify como fallback).
- **RF-17:** O sistema deve transcrever em massa o áudio dos vídeos e quebrá-lo em segmentos com janelas de tempo.
- **RF-18:** O sistema deve gerar embeddings dos segmentos transcritos e indexá-los em banco vetorial para a busca semântica.
- **RF-19:** O sistema deve incorporar automaticamente novos vídeos do canal via agenda diária (scraping → transcrição → indexação).
- **RF-20:** O sistema deve permitir que a administradora de conteúdo acompanhe, por vídeo, o status de scraping, transcrição e indexação e o log das execuções de ingestão.
- **RF-21:** O sistema deve permitir que a administradora de conteúdo monitore quais buscas geram bons resultados e quais não encontram trechos relevantes, sinalizando trechos para revisão.
- **RF-22:** O sistema deve permitir que o gestor de audiência acesse um painel consolidando leads, perfis e temas/dores mais buscados.
- **RF-23:** O sistema deve permitir que o gestor de audiência segmente a audiência por perfil comercial e interesse/tema para viabilizar parcerias.
- **RF-24:** O sistema deve restringir os painéis de gestão e os dados consolidados de leads exclusivamente à equipe Concer (papéis internos).

## 6. Requisitos não-funcionais

- **Performance:** cada busca semântica (embedding da query + recuperação vetorial + geração do plano de ação) deve retornar em ≤ 5 segundos para o volume típico; a busca vetorial usa índice `hnsw` (cosine) em pgvector.
- **Escalabilidade:** a ingestão em massa (scraping/transcrição/indexação de centenas de vídeos) roda em Edge Functions com processamento em lote e cron, sem bloquear a experiência de busca; recomenda-se Supabase Pro para volume de edge invocations e pgvector em escala.
- **Disponibilidade:** a busca deve permanecer disponível independentemente de execuções de ingestão em andamento; falhas de transcrição/indexação são registradas em `ingestion_runs` sem derrubar a plataforma.
- **Segurança:** RLS ativado em todas as tabelas; segmentos e resultados só acessíveis via RPC `search_videos` (SECURITY DEFINER) para usuários autenticados; visitantes não veem recomendações; painéis internos protegidos por `is_concer_staff()`; chaves de APIs externas ficam apenas em Edge Functions, nunca no frontend.
- **LGPD/dados pessoais:** o sistema coleta dados pessoais (nome, e-mail, WhatsApp, perfil comercial) e os usa para geração de lead, nutrição e segmentação — deve haver consentimento explícito no cadastro, base legal para nutrição e mecanismo de exclusão/portabilidade; dados de leads acessíveis apenas por `service_role` e staff; buscas associadas ao perfil só visíveis ao próprio dono e à equipe Concer.
- **Rastreabilidade:** toda execução de ingestão e todo status de nutrição são logados (`ingestion_runs`, `leads.nurture_status`) para auditoria e monitoramento.

## 7. Métricas de sucesso

1. **Cobertura do acervo:** 100% dos vídeos públicos do canal indexados e disponíveis para busca; novos vídeos indexados em ≤ 24h da publicação.
2. **Conversão de cadastro:** ≥ 90% dos visitantes que iniciam a busca concluem o cadastro (acesso gated).
3. **Disparo de nutrição:** 100% dos cadastros concluídos entram na régua de nutrição por e-mail e WhatsApp sem intervenção manual.
4. **Relevância da busca:** ≥ 80% das buscas retornam ao menos um trecho com score de similaridade acima do limiar definido (sem "busca vazia").
5. **Engajamento com timestamp:** ≥ 60% das recomendações clicadas levam o usuário ao vídeo no minuto exato do insight (deep-link acionado).

## 8. Fora de escopo

- **Cobrança do usuário final:** esta versão não inclui pagamento/assinatura para o público de vendas — o acesso exige apenas cadastro; a receita vem de parcerias com empresas (conforme sua descrição).
- **Portal de parceiros/marketplace de anúncios:** a plataforma para empresas parceiras comprarem "vídeos que levem até elas" não é construída aqui — esta versão entrega os dados de audiência segmentada que viabilizam essa negociação, feita fora do sistema.
- **Construção da automação de nutrição em si:** a régua de e-mail (ActiveCampaign) e WhatsApp já existe na empresa; o ConcerFinder apenas dispara o webhook existente, sem recriar os fluxos de mensagem.
- **Geração/edição de conteúdo de vídeo:** a plataforma indexa e recomenda os vídeos existentes do Concer, não produz, edita ou hospeda vídeos próprios.
- **Multi-canal:** nesta versão a base é exclusivamente o canal do Thiago Concer; indexar outros canais fica para iterações futuras.
- **App mobile nativo:** a entrega é a aplicação web React; apps iOS/Android nativos não estão no escopo desta versão.
