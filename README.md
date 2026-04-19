# NestShield Auth API

A NestJS API that demonstrates JWT auth, invite-based onboarding, SES email flows, and security-oriented auth controls (in-memory persistence for demo purposes).

## Highlights
- Auth flows: sign-up, login, refresh rotation, logout, forgot/reset/change password
- Invite-user flows: invite, validate, resend, cancel, complete-sign-up
- AWS SES integration (`@aws-sdk/client-ses`) with Localstack support in `docker-compose`
- Password hashing via Argon2id + random salt + pepper (`PASSWORD_PEPPER`)
- Login hardening with failed-attempt lockout by email/IP
- Refresh token rotation and revocation per device (IP + user-agent)
- Global request validation (`ValidationPipe` with whitelist + forbid non-whitelisted)
- Anonymous requests are rate-limited (authenticated users are not)
- Swagger UI at `/docs`
- Jest unit, integration, and e2e tests
- Dockerfile + docker-compose
- Husky + commitlint for Conventional Commits

## How it works
1. Login (`POST /auth/login`) validates credentials and issues access + refresh tokens.
2. Refresh (`POST /auth/refresh`) validates refresh token and rotates device refresh token.
3. Forgot/reset password uses token-based email flow via SES.
4. Change password requires bearer token and revokes existing refresh sessions.
5. Invite flow sends email token and allows registration only for non-existing emails.
6. Protected profile (`GET /users/me`) requires `Authorization: Bearer <access token>`.

## Project structure
```
.
├── Dockerfile
├── docker-compose.yml
├── commitlint.config.js
├── .husky/
├── .env.example
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── aws/
│   │   ├── aws.module.ts
│   │   └── services/
│   ├── crypto/
│   │   ├── crypto.module.ts
│   │   └── services/
│   ├── rate-limit/
│   │   └── rate-limit.module.ts
│   ├── auth/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── guards/
│   │   ├── strategies/
│   │   └── __tests__/
│   ├── invite-user/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dto/
│   │   ├── entities/
│   │   └── __tests__/
│   ├── users/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── entities/
│   │   └── __tests__/
│   └── types/
└── test/
    └── app.e2e-spec.ts
```

## Environment variables
The app reads config from `.env` via `@nestjs/config`:

- `ACCESS_SECRET`: signs access tokens
- `REFRESH_SECRET`: signs refresh tokens
- `PASSWORD_PEPPER`: pepper used with Argon2id
- `AWS_REGION`: SES region
- `AWS_ACCESS_KEY_ID`: SES credentials
- `AWS_SECRET_ACCESS_KEY`: SES credentials
- `AWS_SES_ENDPOINT`: SES endpoint (Localstack in local dev)
- `AWS_SES_FROM_EMAIL`: email sender used by SES
- `RESET_PASSWORD_URL`: frontend reset-password URL
- `RESET_PASSWORD_EXPIRES_HOURS`: reset token expiration (hours)
- `AUTH_MAX_LOGIN_ATTEMPTS`: max failed login attempts before lockout
- `AUTH_LOCKOUT_MINUTES`: lockout duration
- `INVITE_REGISTER_URL`: frontend sign-up URL for invite flow
- `INVITE_EXPIRES_HOURS`: invite token expiration (hours)

## Sample users (in memory)
Defined in `UsersService`:

| id | name  | email           | password  |
| -- | ----- | --------------- | --------- |
| 0  | Aureo | aureo@gmail.com | aureopass |
| 1  | Bueno | bueno@gmail.com | buenopass |

## Local development
```bash
yarn install
cp .env.example .env
yarn start:dev
```

Open `http://localhost:3000/docs` for Swagger.

## Rate limiting
- Anonymous requests: 20 requests per 60 seconds
- Authenticated requests: no limit (skipped when a valid access token is provided)
- Config lives in `src/rate-limit/rate-limit.module.ts`

## API endpoints
| Method | Path                          | Auth   | Description |
| ------ | ----------------------------- | ------ | ----------- |
| POST   | /auth/sign-up                 | None   | Create account and return tokens |
| POST   | /auth/login                   | None   | Login and return tokens |
| POST   | /auth/refresh                 | None   | Refresh + rotate device token |
| DELETE | /auth/logout                  | None   | Revoke refresh token |
| POST   | /auth/forgot-password         | None   | Start reset password flow |
| POST   | /auth/reset-password          | None   | Reset password using email + token |
| POST   | /auth/change-password         | Bearer | Change password for authenticated user |
| POST   | /invite-user/invite           | None   | Send invite email |
| POST   | /invite-user/validate         | None   | Validate invite token |
| POST   | /invite-user/resend           | None   | Resend invite with new token |
| POST   | /invite-user/cancel           | None   | Cancel invite token |
| POST   | /invite-user/complete-sign-up | None   | Complete registration from invite |
| GET    | /users/me                     | Bearer | Current user profile |

## Docker
```bash
cp .env.example .env
docker compose up --build
```

`docker-compose.yml` includes:
- `api` service
- `localstack` service with SES on `http://localhost:4566`

## Git hooks
Husky runs:
- `pre-commit`: `yarn lint` and `yarn test`
- `commit-msg`: validates Conventional Commits via commitlint

## Scripts
```bash
yarn lint
yarn test
yarn test:unit
yarn test:integration
yarn test:e2e
yarn test:cov
```

## Notes
- Users, refresh tokens, password reset tokens, and invite tokens live in memory and reset on restart.
- This project is demo-oriented; add persistent storage before production use.
