# Páginas do Frontend — ConcerFinder

> **Caminho de build:** Claude Code + Supabase: React + Tailwind + shadcn/ui. As telas abaixo seguem exatamente as rotas definidas na ESTRUTURA técnica. Papéis referenciados no PROCESSO: **Visitante**, **Usuário cadastrado** (perfil comercial: vendedor / gestor comercial / dono de empresa), **Administrador de conteúdo** e **Gestor de audiência/comercial** (ambos = staff Concer).

---

### `/` — Landing (`landing`)

**Propósito:** apresentar o ConcerFinder e converter o visitante em lead, explicando que ele pode descrever qualquer dor de vendas e encontrar exatamente onde o Thiago Concer fala sobre ela.

**Seções da tela:**
- Hero com proposta de valor ("Descreva sua dor de vendas e receba o vídeo e o minuto exato onde o Concer resolve") e CTA principal **"Criar conta grátis"** → `/cadastro`.
- Bloco explicativo do problema: o canal tem centenas de vídeos e o YouTube só busca por palavra-chave, deixando passar insights no meio do vídeo.
- Bloco "Como funciona" em 3 passos (descreve a dor → busca semântica → vídeos com minutagem exata + plano de ação).
- Exemplos de dores de vendas (ex.: "meu time não contorna objeção de preço", "não sei estruturar prospecção").
- Prova social / referência ao Thiago Concer como maior referência em vendas do Brasil.
- Rodapé com link secundário **"Já tenho conta"** → `/login`.

**Estados:**
- **Vazia:** não aplicável — conteúdo é estático/institucional, sempre presente.
- **Carregando:** skeleton leve do hero enquanto a página monta (mínimo, é conteúdo estático).
- **Erro:** se algum recurso não carregar, exibe a página com fallback textual; CTAs de cadastro/login continuam funcionando.

**Permissões:** pública, acessível a **qualquer pessoa (Visitante)**. Usuários já autenticados que caírem aqui veem um CTA alterado para **"Ir para a busca"** → `/busca` em vez de "Criar conta".

---

### `/cadastro` — Sign-up (`sign-up`)

**Propósito:** cadastrar o visitante (gerando lead) e liberar o acesso à busca, disparando a régua de nutrição por e-mail e WhatsApp.

**Seções da tela:**
- Formulário de cadastro com campos: **nome completo**, **e-mail**, **WhatsApp** e **cargo** e senha (ou opção de magic link).
- **[Extensão do doc]** O cargo tem 9 opções, idênticas às do campo Cargo Newsletter do ActiveCampaign: Fundador (a), Sócio (a), Presidente ou CEO, Vice-presidente, Diretor (a), Coordenador (a), Supervisor (a), Gerente, Vendedor. O **perfil comercial** (vendedor / gestor / dono), que é o gatilho da régua de nutrição, passa a ser **derivado** do cargo em vez de perguntado. Motivo: mesma quantidade de campos no formulário, dado muito mais rico para a segmentação, e o lead fica comparável com o resto da base da Concer.
- Texto de contexto reforçando que o cadastro é gratuito e libera a busca imediatamente.
- Aviso de consentimento (LGPD) informando que o usuário receberá conteúdos por e-mail e WhatsApp.
- Botão **"Criar conta e buscar"** (chama a Edge Function `register-lead`).
- Link secundário **"Já tenho conta"** → `/login`.

**Estados:**
- **Vazia:** formulário limpo com placeholders e o cargo sem seleção.
- **[Extensão do doc]** O cadastro preserva o destino: quem chegou por deep link de e-mail (`?t=`/`?s=`) ou clicou numa dor da landing (`?q=`) cai, depois de criar a conta, exatamente onde ia, com a busca já rodando. O WhatsApp ganha máscara `(11) 98888-7777` e é normalizado para dígitos no envio.
- **Carregando:** botão em estado de loading ("Criando conta...") durante o `register-lead`; campos desabilitados.
- **Erro:** mensagens inline por campo (e-mail inválido, WhatsApp obrigatório, e-mail já cadastrado) e banner geral se o cadastro/lead falhar, com opção de tentar novamente. Se o disparo da nutrição falhar mas a conta for criada, o usuário ainda é liberado para a busca (a nutrição fica com `nurture_status='failed'` para reprocessamento pela equipe).

**Permissões:** pública, voltada ao **Visitante**. Usuário já autenticado é redirecionado para `/busca`.

---

### `/login` — Login (`login`)

**Propósito:** autenticar usuários já cadastrados por senha ou magic link.

**Seções da tela:**
- Formulário de login com **e-mail** e **senha**.
- Opção **"Entrar com link mágico"** (magic link enviado ao e-mail) para reduzir atrito.
- Link **"Esqueci minha senha"**.
- Link secundário **"Ainda não tenho conta"** → `/cadastro`.

**Estados:**
- **Vazia:** formulário limpo.
- **Carregando:** botão em loading durante autenticação; ao usar magic link, exibe confirmação "Enviamos um link para seu e-mail".
- **Erro:** mensagem de credenciais inválidas ou conta não encontrada, com CTA para cadastro; erro de envio de magic link com opção de reenviar.

**Permissões:** pública. Usuário já autenticado é redirecionado para `/busca`. Após login, staff (Administrador de conteúdo / Gestor de audiência) passa a enxergar os links dos painéis `/admin/*` na navegação.

---

### `/busca` — Search (`search`)

**Propósito:** permitir que o usuário descreva a dor de vendas em linguagem natural e receba recomendações de vídeos com minutagem exata e plano de ação.

**Seções da tela:**
- Caixa de busca em linguagem natural (textarea) com exemplos de dores como sugestão.
- Botão **"Buscar insights"** (dispara a RPC `search_videos` + `generate-action-plan`).
- **Plano de ação** gerado pela IA no topo dos resultados, resumindo os passos para resolver a dor descrita.
- **Lista de recomendações**: cards de vídeo com thumbnail, título, minutagem exata do insight (start_seconds formatado), score de relevância e botão **"Ver no minuto X"** → `/video/:id`.
- Atalho para **novas buscas** e link para `/busca/historico`.

**Estados:**
- **Vazia (antes da primeira busca):** tela de boas-vindas com a caixa de busca em destaque e sugestões de dores comuns; sem resultados ainda.
- **Sem resultados relevantes:** mensagem "Não encontramos trechos suficientemente relevantes para essa dor" com sugestão de reformular a descrição (regra: a busca é por significado, não palavra-chave).
- **Carregando:** skeleton dos cards e indicador "Analisando sua dor e localizando os melhores trechos..." enquanto embeddings, busca vetorial e plano de ação são gerados.
- **Erro:** banner de erro ("Não foi possível processar sua busca") com botão de tentar novamente, preservando o texto digitado.

**Permissões:** **protegida — apenas Usuário cadastrado** (e staff). Visitante sem cadastro é redirecionado para `/cadastro` (regra crítica: sem cadastro não vê recomendações). A tela é idêntica por perfil comercial; o perfil é usado apenas para segmentação de audiência nos bastidores.

---

### `/busca/historico` — Search History (`search-history`)

**Propósito:** exibir o histórico de buscas do próprio usuário e permitir novas explorações por tema já pesquisado.

**Seções da tela:**
- Lista das buscas anteriores do usuário (query descrita, data e temas detectados).
- Chips de **temas/dores recorrentes** para refazer a busca com um clique.
- Ação **"Repetir busca"** / **"Ver resultados"** que reabre as recomendações associadas.
- Atalho para nova busca → `/busca`.

**Estados:**
- **Vazia:** mensagem "Você ainda não fez nenhuma busca" com CTA **"Fazer minha primeira busca"** → `/busca`.
- **Carregando:** skeleton de lista de itens de histórico.
- **Erro:** banner "Não foi possível carregar seu histórico" com botão de recarregar.

**Permissões:** **protegida — apenas Usuário cadastrado**. Cada usuário vê somente o próprio histórico (RLS: `profile_id = auth.uid()`). Staff vê os próprios registros; a visão agregada de todas as buscas fica em `/admin/audiencia`.

---

### `/video/:id` — Video Detail (`video-detail`)

**Propósito:** abrir o vídeo do canal do Concer diretamente no minuto do insight recomendado (deep-link para o YouTube no timestamp).

**Seções da tela:**
- Player/embed do vídeo do YouTube iniciando no `start_seconds` do trecho relevante.
- Título, descrição e data de publicação do vídeo.
- Trecho/segmento destacado (contexto textual do insight) e sua minutagem.
- Lista de **outros trechos relevantes** do mesmo vídeo (se houver) e vídeos relacionados por tema.
- Botão **"Voltar aos resultados"** → `/busca` e botão **"Abrir no YouTube"** com o link no timestamp.

**Estados:**
- **Vazia:** se o vídeo existir mas ainda não tiver trecho destacado, mostra o vídeo desde o início com aviso "Sem timestamp específico para esta recomendação".
- **Carregando:** skeleton do player e dos metadados.
- **Erro:** mensagem "Vídeo não encontrado ou indisponível" com CTA para voltar à busca; trata o caso de vídeo removido do canal.

**Permissões:** **protegida — apenas Usuário cadastrado** (e staff). Visitante é redirecionado para `/cadastro`.

---

### `/admin/conteudo` — Admin Content (`admin-content`)

**Propósito:** dar ao Administrador de conteúdo visão do status de scraping, transcrição e indexação de cada vídeo e das execuções de ingestão.

**Seções da tela:**
- Painel de **status geral da base** (total de vídeos, quantos indexados, pendentes, falhas).
- **Tabela de vídeos** com título, `youtube_video_id`, data de publicação e `transcription_status` (pending / transcribing / transcribed / indexed / failed). Falha por falta de legenda aparece como **"Sem legenda"**, em cinza, lendo `videos.failure_reason`. Todo vídeo em `failed` tem **"Tentar de novo"**, único caminho de volta: a esteira diária só olha `pending`, então sem esse botão um vídeo que falhou fica fora do acervo para sempre, mesmo depois de a legenda ser ligada no YouTube.
- **Log de `ingestion_runs`** por tipo (scrape / transcribe / index), status, quantidade processada, erro e tempos. A mensagem só é vermelha quando `videos_failed > 0`: execução que transcreveu tudo e esbarrou num vídeo sem legenda mostra o recado em cinza.
- Botão **"Rodar scraping agora"** (dispara `scrape-youtube-channel` manualmente, além do cron diário).
- Ação de **sinalizar vídeo/trecho para revisão** quando a minutagem estiver imprecisa.

**Estados:**
- **Vazia:** se a base ainda não foi ingerida, mensagem "Nenhum vídeo indexado ainda" com CTA **"Rodar primeira ingestão"**.
- **Carregando:** skeleton da tabela e dos indicadores de status.
- **Erro:** banner de falha ao carregar os dados de ingestão; falhas individuais aparecem destacadas em vermelho na tabela com o `error_message`.

**Permissões:** **staff-only — Administrador de conteúdo** (papel `content_admin`). Gestor de audiência pode ter acesso de leitura conforme atribuição interna. Usuário cadastrado comum e Visitante não acessam — redirecionados para `/busca` (ou `/` se não autenticado).

---

### `/admin/audiencia` — Admin Audience (`admin-audience`)

**Propósito:** dar ao Gestor de audiência/comercial a visão consolidada de leads, perfis e temas/dores mais buscados para segmentar a audiência e viabilizar parcerias.

**Seções da tela:**
- **Indicadores de leads** (total de cadastros, distribuição por perfil comercial: vendedor / gestor comercial / dono de empresa).
- **Ranking de temas/dores mais buscados** (agregação de `searches.detected_topics` via `get_audience_insights()`), cruzado por perfil comercial.
- **Quem procura o quê**: para cada perfil comercial (vendedor / gestor / dono), os temas que ele mais busca. É o corte que sustenta a conversa com um parceiro. **[Extensão do doc]**
- **Crescimento** (`get_engagement_insights()`): cadastros, buscas e trechos abertos por dia (por semana acima de 42 dias). O painel não tinha nenhuma série temporal, então não respondia "estamos crescendo?". **[Extensão do doc]**
- **Funil de ativação**: cadastrou → buscou → abriu trecho → voltou em outro dia. Lead que se cadastra e nunca busca é e-mail, não lead qualificado; o funil separa os dois e mostra quantos ficaram de fora da régua de nutrição. Acompanhado de **recorrência** (em quantos dias distintos cada pessoa buscou) e **intensidade** (buscas por pessoa, taxa de abertura). **[Extensão do doc]**
- **Qualidade da busca**: relevância média e mínima (similaridade de cosseno do melhor trecho de cada busca), buscas com plano de ação e buscas sem resultado. "Dores sem resposta" cobria só o caso extremo; o caso comum é a busca que devolve algo fraco e a pessoa vai embora sem reclamar. **[Extensão do doc]**
- **Pauta vinda da audiência**: temas mais buscados cruzados com a relevância que o acervo consegue entregar e quantos trechos existem sobre o tema. Relevância baixa em tema muito buscado é pedido de vídeo novo, vindo direto de quem busca. **[Extensão do doc]**
- **Acervo ocioso**: vídeos indexados que a busca nunca recomendou. Conteúdo pronto que não está trabalhando; vale rever título, descrição ou temas. **[Extensão do doc]**
- **Cadastros por cargo** e **o que cada cargo procura** (`get_cargo_insights()`): a mesma leitura na granularidade dos 9 cargos, que é a que interessa a um parceiro ("temos N diretores comerciais procurando previsibilidade" diz mais do que "temos N gestores"). Cada cargo aparece com a régua para a qual aponta. **[Extensão do doc]**
- **Trechos mais recomendados** (o que a busca devolveu, de `search_results`) e **trechos mais assistidos** (o que as pessoas abriram, de `video_views`), lado a lado. A distância entre os dois mostra o que recomenda bem mas não convence a clicar. **[Extensão do doc]**
- **Vídeos que mais aparecem**, com recomendações e aberturas por vídeo, para decidir o que repostar e sobre o que gravar mais. **[Extensão do doc]**
- **Tabela de leads** com nome, e-mail, WhatsApp, perfil, status da nutrição (`nurture_status`) e data de cadastro.
- Segmentação/filtros por perfil e por tema de interesse para identificar grupos relevantes a empresas parceiras.
- Indicador de saúde da nutrição (pending / sent / failed) para acompanhar a régua de e-mail e WhatsApp.
- **Equipe e permissões** (visível apenas para o papel `admin`): lista os usuários com papel e volume de buscas, e permite promover ou rebaixar. O admin não consegue remover o próprio acesso, para a conta nunca ficar sem administrador. **[Extensão do doc]**

**Estados:**
- **Vazia:** se ainda não houver leads/buscas, mensagem "Sem dados de audiência ainda — os insights aparecem conforme os usuários se cadastram e buscam".
- **Carregando:** skeleton dos gráficos, do ranking e da tabela de leads.
- **Erro:** banner "Não foi possível carregar os insights de audiência" com botão de recarregar.

**Permissões:** **staff-only — Gestor de audiência/comercial** (papel `audience_manager`). Administrador de conteúdo pode ter acesso de leitura conforme atribuição interna. Usuário cadastrado comum e Visitante não acessam — redirecionados para `/busca` (ou `/`). Dados sensíveis de leads só são expostos aqui, protegidos por RLS (`is_concer_staff()`).


## `/redefinir-senha` **[Extensão do doc]**

Destino do "esqueci minha senha". Precisa ser rota própria: o link do e-mail cria a sessão e, quando apontava para `/login`, a página detectava "autenticado" e mandava para `/busca`; a pessoa nunca via a tela de digitar a senha nova. Escuta `PASSWORD_RECOVERY`, valida mínimo de 8 caracteres e confirmação, e trata link expirado com caminho de volta ao login.
