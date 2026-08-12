-- ---------------------------------------------------------------------------
-- Busca semântica: troca do índice ivfflat por HNSW
--
-- POR QUE: medido em 12/08/2026 com 1.333 trechos, o recall@10 da busca era de
-- 16%. Ou seja, 84% dos trechos realmente mais próximos da dor descrita nunca
-- chegavam à pessoa. Nada quebrava e nada aparecia no painel: a recomendação
-- só era pior, em silêncio, que é o pior tipo de defeito para o produto cuja
-- promessa inteira é "o vídeo certo, no minuto certo".
--
-- Duas causas somadas:
--   1. O ivfflat foi criado junto com a tabela, VAZIA. O ivfflat agrupa os
--      vetores em `lists` centroides calculados no momento da criação; sem
--      nenhuma linha para treinar, os centroides não representam o acervo.
--   2. `lists = 100` com `probes` no padrão (1) faz a consulta varrer 1 de 100
--      listas, cerca de 13 dos 1.333 trechos, e devolver o melhor daquele 1%.
--
-- POR QUE HNSW E NÃO CONSERTAR O IVFFLAT: medido nas mesmas 8 consultas,
-- probes=10 sobe o recall para 76% e probes=40 para 91%, sempre pagando mais
-- varredura. E o ivfflat precisaria ser reconstruído a cada salto de volume,
-- porque os centroides envelhecem: o acervo cresce todo dia pelo cron e vai de
-- 1.333 para cerca de 6.600 trechos quando os 500 vídeos estiverem indexados.
-- O HNSW não tem etapa de treino, aceita inserção incremental sem degradar e
-- entrega recall alto no padrão. No tamanho deste acervo o custo é irrelevante.
-- ---------------------------------------------------------------------------

-- O nome do índice é o mesmo, então o ivfflat sai antes. A janela sem índice
-- dura segundos neste volume, e durante ela a busca fica exata (varredura
-- completa), não indisponível.
drop index if exists public.idx_video_segments_embedding;

create index idx_video_segments_embedding
  on public.video_segments using hnsw (embedding vector_cosine_ops);
