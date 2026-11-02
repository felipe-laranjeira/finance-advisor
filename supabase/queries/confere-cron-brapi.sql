WITH ultima_execucao AS (
  SELECT
    status,
    started_at,
    completed_at,
    requested_count,
    succeeded_count,
    request_count,
    detail
  FROM public.job_runs
  WHERE job_name = 'daily-market-snapshot'
  ORDER BY started_at DESC
  LIMIT 1
)
SELECT
  e.status AS status_execucao,
  e.started_at AS inicio_execucao,
  e.completed_at AS fim_execucao,
  e.requested_count AS solicitados,
  e.succeeded_count AS sucesso,
  e.request_count AS requisicoes,
  e.detail AS detalhes_erro,
  t.symbol AS ticker,
  c.name AS empresa,
  c.sector AS setor,
  t.exchange AS bolsa,
  p.price AS preco,
  p.quote_at AS horario_cotacao,
  p.is_stale AS dado_desatualizado,
  p.provider AS provedor,
  p.last_checked_at AS ultima_verificacao,
  p.fetched_at AT TIME ZONE 'America/Sao_Paulo' AS ultima_atualizacao_brasilia
FROM public.tickers AS t
JOIN public.companies AS c
  ON c.id = t.company_id
LEFT JOIN public.prices_latest AS p
  ON p.ticker = t.symbol
LEFT JOIN ultima_execucao AS e
  ON TRUE
WHERE t.is_active = TRUE
  AND t.exchange = 'B3'
ORDER BY t.display_order, t.symbol;