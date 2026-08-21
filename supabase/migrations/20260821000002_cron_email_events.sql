-- ---------------------------------------------------------------------------
-- Sincronização do engajamento por e-mail no cron.
--
-- Os eventos de e-mail (envio e clique) vêm do ActiveCampaign e não chegam
-- sozinhos: sem uma rodada periódica, o painel de engajamento nasce certo e
-- envelhece em silêncio, que é pior do que não existir.
--
-- De 6 em 6 horas, e não uma vez por dia: durante um lançamento a régua dispara
-- o dia inteiro, e um clique que só aparece no relatório no dia seguinte chega
-- tarde demais para virar ligação.
--
-- A função de chamada é a mesma da esteira de ingestão, que já resolve o
-- segredo do Vault e o net.http_post. O que muda é a lista de etapas aceitas.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_ingestion_step(step text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
declare
  segredo text;
  req_id bigint;
  corpo jsonb;
begin
  if step not in ('scrape-youtube-channel', 'transcribe-videos', 'index-segments', 'sync-email-events') then
    raise exception 'Etapa desconhecida: %', step;
  end if;

  select decrypted_secret into segredo
  from vault.decrypted_secrets where name = 'concerfinder_cron_secret';

  if segredo is null then
    raise exception 'Segredo concerfinder_cron_secret nao encontrado no Vault.';
  end if;

  -- Cada video custa 250 unidades da YouTube Data API (captions.list 50 +
  -- captions.download 200) contra uma cota diaria de 10.000, ou seja 40
  -- videos/dia. 35 deixa folga para o scrape e para retentativas.
  corpo := case step
    when 'transcribe-videos' then '{"batch_size": 35}'::jsonb
    when 'index-segments' then '{"batch_size": 500}'::jsonb
    else '{}'::jsonb
  end;

  select net.http_post(
    url := 'https://lzjwiibsqbowrrekptvg.supabase.co/functions/v1/' || step,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', segredo),
    body := corpo,
    timeout_milliseconds := 300000
  ) into req_id;

  return req_id;
end;
$function$
;


select cron.unschedule('cron_email_events') where exists (
  select 1 from cron.job where jobname = 'cron_email_events'
);

select cron.schedule(
  'cron_email_events',
  '25 */6 * * *',
  $$select public.run_ingestion_step('sync-email-events')$$
);
