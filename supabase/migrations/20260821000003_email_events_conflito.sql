-- ---------------------------------------------------------------------------
-- O índice de unicidade de email_events precisa ser declarável no upsert.
--
-- A primeira versão usava `coalesce(link_url, '')`, que resolve a unicidade no
-- banco mas é um índice por expressão: o PostgREST não consegue casar isso com
-- um ON CONFLICT, e a sincronização quebrava com "no unique or exclusion
-- constraint matching the ON CONFLICT specification".
--
-- Troca por índice de colunas com NULLS NOT DISTINCT, que trata os envios (link
-- nulo) como iguais entre si e mantém a idempotência da rodada.
-- ---------------------------------------------------------------------------

drop index if exists public.idx_email_events_unico;

create unique index if not exists idx_email_events_unico
  on public.email_events (ac_contact_id, campaign_id, tipo, link_url, ocorrido_em)
  nulls not distinct;
