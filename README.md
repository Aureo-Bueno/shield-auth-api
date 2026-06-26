# NestShield Auth API

API em NestJS focada em autenticação e segurança, com fluxos de convite, trilha de auditoria e observabilidade.

## Visão geral

- API versionada por URI: `/v1/...`
- Swagger em `/docs`
- Persistência em memória (tokens, usuários, convites e auditoria)
- Estrutura modular com separação por camadas (`presentation`, `application`, `infrastructure`)

## Funcionalidades principais

### Autenticação

- Sign-up, login, refresh e logout
- Refresh token com rotação por dispositivo (IP + user-agent)
- Forgot password, reset password e change password
- JWT Bearer para rotas protegidas

### Autorização

- RBAC com `@Roles()`
- Permissões finas com `@Permissions()`
- ABAC com `@CheckPolicies()` (ex.: usuário comum só acessa o próprio recurso)

### Segurança

- CSRF middleware opcional (`CSRF_ENABLED=true`)
- Headers de hardening com `helmet`
- Mitigação de brute force com lockout + backoff progressivo no login
- Rate limit para anônimos (autenticados e health checks são ignorados)
- Canal de integração com `API Key` ou `OAuth2 Bearer` (tokens via env)

### Auditoria

- Interceptor global para operações mutáveis (`POST`, `PUT`, `PATCH`, `DELETE`)
- Registro de ator, rota, status HTTP, duração, IP e user-agent
- Consulta de eventos em `/v1/audit/events` (admin)

### Observabilidade

Stack completa: **Grafana + Prometheus + Loki + Tempo**

| Componente | Função | Acesso |
|------------|--------|--------|
| **Prometheus** | Métricas do Node.js (heap, gc, cpu, event loop) | `localhost:9090` |
| **Loki** | Logs estruturados com `trace_id` linkado | `localhost:3100` |
| **Tempo** | Traces distribuídos via OTLP HTTP | `localhost:3200` |
| **Grafana** | Dashboards e correlação entre tudo | `localhost:3001` (admin/admin) |

**Correlação**: logs → traces e traces → logs já configurados nos datasources do Grafana.

- Tracing via OpenTelemetry SDK com auto-instrumentações (HTTP, Express, NestJS core, pino)
- SDK iniciado com `--require` antes do app carregar (para instrumentar módulos em tempo)
- Logs estruturados com `nestjs-pino`, `trace_id`/`span_id` injetados automaticamente pelo `instrumentation-pino`
- Métricas do Node.js expostas em `GET /metrics` via `prom-client` e coletadas pelo Prometheus
- Sentry com `skipOpenTelemetrySetup: true` para não conflitar com o OTel manual
- Health checks em `/v1/health/live` e `/v1/health/ready`

### Sentry

O Sentry é inicializado no bootstrap da aplicação e usa `ConfigService` para ler as variáveis de ambiente.

Principais variáveis:

- `SENTRY_DSN`
- `SENTRY_RELEASE`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_PROFILING_ENABLED`
- `SENTRY_PROFILE_SESSION_SAMPLE_RATE`
- `SENTRY_PROFILE_LIFECYCLE`

Comportamento atual:

- Captura erros não tratados via `SentryGlobalFilter`.
- Suporta tracing quando `SENTRY_TRACES_SAMPLE_RATE` for maior que zero.
- Suporta profiling quando `SENTRY_PROFILING_ENABLED=true`.

## Fluxos (Mermaid)

### 1) Fluxo de requisição na API

```mermaid
flowchart LR
    C[Cliente] --> V["API v1"]
    V --> M[CSRF]
    M --> T[Throttler]
    T --> G{Rota protegida?}
    G -- Não --> CT[Controller]
    G -- Sim --> J[JwtAuthGuard]
    J --> A["Authorization\nRBAC + ABAC"]
    A --> CT
    CT --> S[Application Service]
    S --> I[(In-memory Store)]
    CT --> R[Resposta]

    S -. mutating routes .-> AU[Audit Interceptor]
    AU -. record .-> AR[(Audit Repository)]
```

### 2) Fluxo de autenticação + rotação de refresh

```mermaid
sequenceDiagram
    participant U as Usuário
    participant API as AuthController
    participant AS as AuthService

    U->>API: POST /v1/auth/login
    API->>AS: valida credenciais
    AS-->>U: accessToken + refreshToken

    U->>API: POST /v1/auth/refresh (refreshToken)
    API->>AS: valida token atual
    AS->>AS: revoga token antigo e emite novo
    AS-->>U: novo accessToken + novo refreshToken

    U->>API: DELETE /v1/auth/logout
    API->>AS: remove refresh token ativo
    AS-->>U: logout concluído
```

### 3) Fluxo de convite (onboarding)

```mermaid
sequenceDiagram
    participant ADM as Admin
    participant API as InviteUserController
    participant IS as InviteUserService
    participant SES as AWS SES
    participant NV as Novo usuário

    ADM->>API: POST /v1/invite-user/invite
    API->>IS: criar token de convite
    IS->>SES: enviar e-mail com link
    SES-->>NV: convite recebido

    NV->>API: POST /v1/invite-user/validate
    API->>IS: validar token + expiração
    IS-->>NV: convite válido

    NV->>API: POST /v1/invite-user/complete-sign-up
    API->>IS: finalizar cadastro com senha
    IS-->>NV: usuário criado
```

## Arquitetura de pastas (canônica)

```text
src/
  app.module.ts
  main.ts

  auth/
    presentation/controllers/
    application/services/
    infrastructure/guards/
    infrastructure/strategies/
    authorization/
    dto/
    entities/

  users/
    presentation/controllers/
    application/services/
    entities/

  invite-user/
    presentation/controllers/
    application/services/
    dto/
    entities/

  security/
    presentation/guards/
    application/services/
    middlewares/

  audit/
    domain/
    application/ports/
    application/use-cases/
    application/services/
    infrastructure/repositories/
    presentation/controllers/
    presentation/interceptors/

  observability/
  health/
  integrations/
  rate-limit/
  aws/
  crypto/
```

Nota: alguns caminhos legados (`controllers/`, `services/`, etc.) ainda existem como re-export para compatibilidade durante migração.

## Endpoints

### Auth

| Método | Rota                       | Auth   | Descrição                                   |
| ------ | -------------------------- | ------ | ------------------------------------------- |
| POST   | `/v1/auth/sign-up`         | Não    | Cria conta e retorna tokens                 |
| POST   | `/v1/auth/login`           | Não    | Login e emissão de tokens                   |
| POST   | `/v1/auth/refresh`         | Não    | Rotaciona refresh token e emite novo access |
| DELETE | `/v1/auth/logout`          | Não    | Revoga refresh token                        |
| POST   | `/v1/auth/forgot-password` | Não    | Inicia fluxo de reset por e-mail            |
| POST   | `/v1/auth/reset-password`  | Não    | Reseta senha via token                      |
| POST   | `/v1/auth/change-password` | Bearer | Altera senha do usuário autenticado         |

### Invite user

| Método | Rota                               | Auth           | Descrição                     |
| ------ | ---------------------------------- | -------------- | ----------------------------- |
| POST   | `/v1/invite-user/invite`           | Bearer (admin) | Envia convite                 |
| POST   | `/v1/invite-user/resend`           | Bearer (admin) | Reenvia convite               |
| POST   | `/v1/invite-user/validate`         | Não            | Valida token de convite       |
| POST   | `/v1/invite-user/cancel`           | Bearer (admin) | Cancela convite               |
| POST   | `/v1/invite-user/complete-sign-up` | Não            | Finaliza cadastro via convite |

### Users, audit, integrations e health

| Método | Rota                      | Auth                     | Descrição                                                    |
| ------ | ------------------------- | ------------------------ | ------------------------------------------------------------ |
| GET    | `/v1/users/me`            | Bearer                   | Perfil do usuário autenticado                                |
| GET    | `/v1/users/:id`           | Bearer + ABAC            | Usuário comum: próprio ID, admin: qualquer ID                |
| GET    | `/v1/audit/events`        | Bearer (admin)           | Lista eventos de auditoria                                   |
| GET    | `/v1/integrations/status` | API Key ou OAuth2 Bearer | Status para integrações                                      |
| GET    | `/v1/health/live`         | Não                      | Liveness                                                     |
| GET    | `/v1/health/ready`        | Não                      | Readiness (memória, disco, event loop, dependência opcional) |

## Variáveis de ambiente

Use `.env.example` como base.

Principais variáveis:

- `ACCESS_SECRET`, `REFRESH_SECRET`, `PASSWORD_PEPPER`
- `AUTH_MAX_LOGIN_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`, `AUTH_LOGIN_BACKOFF_MAX_MS`
- `RESET_PASSWORD_URL`, `RESET_PASSWORD_EXPIRES_HOURS`
- `INVITE_REGISTER_URL`, `INVITE_EXPIRES_HOURS`
- `CSRF_ENABLED`, `CSRF_TOKEN`, `CSRF_ALLOWED_ORIGINS`
- `API_KEYS`, `OAUTH2_ACCESS_TOKENS`, `OAUTH2_AUTH_URL`, `OAUTH2_TOKEN_URL`
- `OTEL_ENABLED`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_LOG_LEVEL`, `LOG_LEVEL`, `METRICS_ENABLED`
- `SENTRY_DSN`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILING_ENABLED`, `SENTRY_PROFILE_SESSION_SAMPLE_RATE`, `SENTRY_PROFILE_LIFECYCLE`
- `ARGON2_TIME_COST`, `ARGON2_MEMORY_COST_KIB`, `ARGON2_PARALLELISM`, `ARGON2_HASH_LENGTH`
- `API_PUBLIC_URL`
- `HEALTH_MAX_HEAP_BYTES`, `HEALTH_MAX_RSS_BYTES`, `HEALTH_DISK_PATH`, `HEALTH_DISK_THRESHOLD_PERCENT`, `HEALTH_EVENT_LOOP_LAG_MS`, `HEALTH_DEPENDENCY_URL`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_ENDPOINT`, `AWS_SES_FROM_EMAIL`

## Usuários seed (in-memory)

| id  | nome  | email           | senha     | role  |
| --- | ----- | --------------- | --------- | ----- |
| 0   | Aureo | aureo@gmail.com | aureopass | admin |
| 1   | Bueno | bueno@gmail.com | buenopass | user  |

## Como executar

```bash
yarn install
cp .env.example .env
yarn start:dev
```

- Swagger: `http://localhost:3000/docs`
- Rotas versionadas: `http://localhost:3000/v1/...`

## Docker

```bash
cp .env.example .env
# Edite OTEL_ENABLED=true no .env
docker compose up --build
```

O `docker-compose.yml` sobe:

- `api` — NestJS na porta `3000` com `/metrics`, tracing e logs estruturados
- `localstack` — SES em `http://localhost:4566`
- `prometheus` — Métricas em `localhost:9090`
- `loki` — Logs em `localhost:3100`
- `tempo` — Traces OTLP HTTP em `localhost:4318`, query em `localhost:3200`
- `grafana` — Dashboards em `localhost:3001` (admin/admin)
- `promtail` — Coleta logs dos containers para o Loki

## Testes

```bash
yarn test
yarn test:unit
yarn test:integration
yarn test:e2e
yarn test:cov
```

## Observações

- Este projeto é demonstrativo e usa armazenamento em memória.
- Para produção: adicionar banco de dados persistente, rotação/gestão segura de segredos e provider OAuth2 real.
