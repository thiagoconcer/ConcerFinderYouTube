-- ---------------------------------------------------------------------------
-- Por que um vídeo falhou: o motivo passa a ser registrado, não adivinhado.
--
-- O painel separava "não há legenda para transcrever" de "a esteira quebrou"
-- pela DURAÇÃO do vídeo (<= 90s virava "Sem legenda", em cinza). Era um chute,
-- e errava dos dois lados:
--
--   - "O vídeo MAIS IMPORTANTE do ANO", de 6 minutos, não tem legenda no
--     YouTube e aparecia em vermelho como falha da esteira, mandando a equipe
--     procurar um defeito que não existe.
--   - Uma falha DE VERDADE num short seria pintada de cinza e escondida, que é
--     exatamente o que a distinção existia para evitar.
--
-- Agora quem sabe o motivo é quem tentou: `transcribe-videos` grava
-- 'sem_legenda' quando as quatro estratégias devolveram vazio sem erro, e
-- 'erro' quando alguma estourou de verdade.
-- ---------------------------------------------------------------------------

alter table public.videos
  add column if not exists failure_reason text
    check (failure_reason in ('sem_legenda', 'erro'));

comment on column public.videos.failure_reason is
  'Motivo da última falha de transcrição: sem_legenda (o YouTube não tem '
  'legenda, retentar não resolve) ou erro (falhou de verdade, investigar). '
  'Nulo quando o vídeo não está em failed.';

-- Backfill do que já está no banco. Só os vídeos cujo motivo está PROVADO no
-- log de ingestion_runs viram 'sem_legenda'; os demais ficam nulos e o painel
-- os mostra como falha de motivo desconhecido, que um "Tentar de novo"
-- resolve. Chutar aqui seria repetir o erro que esta migration corrige.
update public.videos v
set failure_reason = 'sem_legenda'
where v.transcription_status = 'failed'
  and v.failure_reason is null
  and exists (
    select 1 from public.ingestion_runs r
    where r.error_message like '%' || v.youtube_video_id || ': Nenhuma transcri%'
  );

-- ---------------------------------------------------------------------------
-- Contadores da execução: quantos quebraram e quantos só não têm legenda.
--
-- `transcribe-videos` já calculava os dois e devolvia na resposta HTTP, mas
-- nada era gravado: a execução guardava só `videos_processed`. Sem isso o
-- painel não tem como saber se a mensagem de uma execução `completed` é um
-- aviso ("2 vídeos sem legenda") ou um problema ("2 vídeos quebraram"), e
-- acabava pintando as duas de vermelho. Era esse o borrão vermelho enorme na
-- execução de 18/08, que tinha transcrito 33 vídeos com sucesso.
-- ---------------------------------------------------------------------------

alter table public.ingestion_runs
  add column if not exists videos_failed int not null default 0,
  add column if not exists videos_sem_legenda int not null default 0;

comment on column public.ingestion_runs.videos_failed is
  'Vídeos que falharam de verdade nesta execução (esteira quebrada).';
comment on column public.ingestion_runs.videos_sem_legenda is
  'Vídeos que o YouTube não legenda. Não é falha: é conteúdo sem o que transcrever.';
