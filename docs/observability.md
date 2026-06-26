# Observabilidade — Grafana + Prometheus + Loki + Tempo

## Stack

| Componente | Função | Acesso |
|------------|--------|--------|
| **Prometheus** | Métricas (armazenamento e consulta) | `http://localhost:9090` |
| **Loki** | Logs estruturados | `http://localhost:3100` |
| **Tempo** | Traces distribuídos (OTLP HTTP) | `http://localhost:3200` |
| **Grafana** | Dashboards e correlação entre tudo | `http://localhost:3001` (admin/admin) |
| **Promtail** | Coleta logs dos containers Docker → Loki | — |

## Arquitetura

```
                  ┌──────────────────────────────────────────┐
                  │           API (shield-auth-api)           │
                  │                                           │
                  │  ┌──────────┐  ┌──────────┐              │
                  │  │   pino   │  │ prom-    │              │
                  │  │ (logs)   │  │ client   │              │
                  │  └────┬─────┘  └────┬─────┘              │
                  │       │             │                    │
                  │  ┌────▼─────────────▼─────┐              │
                  │  │    OpenTelemetry SDK    │              │
                  │  │  (auto-instrumentação)  │              │
                  │  └───────────┬────────────┘              │
                  │              │ OTLP HTTP                 │
                  └──────────────┼───────────────────────────┘
                                 │
        stdout ──────┬───────────┤
                     │           │
               ┌─────▼───┐ ┌────▼────┐
               │ promtail │ │  Tempo  │
               └────┬─────┘ └────┬────┘
                    │            │
               ┌────▼────┐ ┌────▼───────┐
               │  Loki   │ │ Prometheus  │
               └────┬────┘ └────┬───────┘
                    │           │
                    └─────┬─────┘
                          │
                    ┌─────▼──────┐
                    │  Grafana   │
                    └────────────┘
```

## Correlação entre dados

O Grafana já vem com os três datasources configurados e linkados:

- **Logs → Traces**: no Loki, o campo `trace_id` nos logs é um link clicável que abre o trace correspondente no Tempo.
- **Traces → Logs**: no Tempo, cada span tem um botão "Logs" que busca os logs daquele trace no Loki.
- **Métricas + Traces + Logs**: tudo no mesmo Grafana, pode montar dashboards combinando os três.

## Como subir

```bash
# Garanta que .env tem essas variáveis
OTEL_ENABLED=true
METRICS_ENABLED=true

# Sobe toda a stack
docker compose up -d
```

## Variáveis de ambiente relevantes

| Variável | Default | Descrição |
|----------|---------|-----------|
| `OTEL_ENABLED` | `false` | Liga/desliga o OpenTelemetry |
| `OTEL_SERVICE_NAME` | `shield-auth-api` | Nome do serviço nos traces |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | Endpoint do Tempo |
| `OTEL_METRICS_EXPORTER` | — | `none` desliga export OTel de métricas |
| `OTEL_LOGS_EXPORTER` | — | `none` desliga export OTel de logs |
| `METRICS_ENABLED` | — | Liga o `prom-client` (métricas Node.js) |
| `LOG_LEVEL` | `info` | Nível do pino logger |

## Como usar no Grafana

### Métricas (Prometheus)
1. Menu ☰ → **Explore**
2. Datasource: **Prometheus**
3. Digite `nodejs_heap_size_used_bytes{job="shield-auth-api"}` → **Run query**

### Logs (Loki)
1. Menu ☰ → **Explore**
2. Datasource: **Loki**
3. Digite `{container=~".*shield-auth.*"}` → **Run query**
4. Clique em qualquer `trace_id` para ver o trace no Tempo

### Traces (Tempo)
1. Menu ☰ → **Explore**
2. Datasource: **Tempo**
3. Aba **Search** → service `shield-auth-api` → **Find traces**
4. Clique num trace para ver a árvore de spans

### Dashboard rápida
1. Menu ☰ → **Dashboards** → **New** → **Import**
2. ID `18875` (Node.js) → **Load** → datasource **Prometheus** → **Import**

## Comandos úteis

```bash
# Ver targets do Prometheus
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Ver spans recebidos no Tempo
curl -s http://localhost:3200/metrics | grep tempo_distributor_spans_received_total

# Buscar traces no Tempo
curl -s --get 'http://localhost:3200/api/search' \
  --data-urlencode 'q={resource.service.name="shield-auth-api"}'

# Ver logs no Loki
curl -s 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={container=~".*shield-auth.*"}' \
  --data-urlencode 'limit=5'

# Ver métricas da API no Prometheus
curl -s 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=nodejs_heap_size_used_bytes{job="shield-auth-api"}'
```

## Código fonte

### `src/observability/`

| Arquivo | Função |
|---------|--------|
| `instrumentation.ts` | **Entrypoint preload** (`--require`). Inicia o OTel SDK antes de qualquer módulo. |
| `tracing.ts` | Configura o `NodeSDK` com auto-instrumentações e exporta spans via OTLP para o Tempo. |
| `metrics.ts` | Inicializa `prom-client` com métricas default do Node.js (heap, gc, cpu, event loop). |
| `sentry.ts` | Integração com Sentry (com `skipOpenTelemetrySetup: true` para não conflitar). |
| `logger.config.ts` | Configura o pino como logger estruturado. O `trace_id`/`span_id` é injetado automaticamente pelo `@opentelemetry/instrumentation-pino`. |

### Fluxo de inicialização

1. `node --require ./dist/observability/instrumentation.js dist/main`
2. `instrumentation.ts` chama `initializeTracing()` com `process.env`
3. O `NodeSDK` é iniciado com auto-instrumentações (HTTP, Express, NestJS core, pino...)
4. O `dist/main` carrega, criando o NestJS app — já instrumentado
5. Dentro do bootstrap, Sentry e métricas são inicializados

### `GET /metrics`

Endpoint exposto fora do router NestJS (sem overhead de pipes/guards/interceptors) que retorna as métricas do `prom-client` no formato Prometheus. Coletado pelo Prometheus a cada 15s.

## Configurações de infra

| Arquivo | Descrição |
|---------|-----------|
| `infra/prometheus/prometheus.yml` | Scrape da API (`:3000/metrics`), do próprio Prometheus e do Tempo |
| `infra/loki/loki-config.yml` | Armazenamento local de logs com schema v13 |
| `infra/tempo/tempo-config.yml` | Receptor OTLP HTTP na `:4318`, storage local, gerador de métricas |
| `infra/promtail/promtail-config.yml` | Descoberta automática de containers Docker via socket |
| `infra/grafana/datasources/datasources.yml` | Datasources pré-configurados com correlação entre Loki e Tempo |

## Solução de problemas

**"Nenhum trace aparece no Tempo"**
- Verifique `OTEL_ENABLED=true` no .env
- Verifique se o container da API consegue resolver o hostname `tempo`: `docker compose exec api ping tempo`
- Confira os logs: `docker compose logs api | grep -i error`

**"ECONNREFUSED na porta 4318"**
- As variáveis `OTEL_METRICS_EXPORTER=none` e `OTEL_LOGS_EXPORTER=none` devem estar setadas no docker-compose para o OTel não tentar exportar métricas/logs via OTLP (usamos prom-client e pino em vez disso).

**"trace_id duplicado nos logs"**
- O `@opentelemetry/instrumentation-pino` já injeta `trace_id`/`span_id` automaticamente. Remova qualquer `customProps` manual que também adicione esses campos.
