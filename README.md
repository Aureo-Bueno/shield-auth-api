# NestShield Auth API

A small NestJS API that demonstrates JWT access/refresh tokens, in-memory users, and a rate-limited public surface.

## Highlights
- Login, refresh, logout, and a protected profile endpoint
- Access tokens expire in 1 hour
- Refresh tokens stored in memory with IP and user-agent metadata
- Anonymous requests are rate-limited (authenticated users are not)
- Swagger UI at `/docs`
- Jest unit and integration tests
- Dockerfile + docker-compose
- Husky + commitlint for Conventional Commits

## How it works
1. Login (`POST /auth/login`) validates the in-memory user and issues access + refresh tokens.
2. Refresh (`POST /auth/refresh`) verifies the refresh token signature and returns a new access token.
3. Logout (`DELETE /auth/logout`) removes refresh tokens from memory.
4. Protected profile (`GET /users/me`) requires `Authorization: Bearer <access token>`.

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
The app reads secrets from `.env` via `@nestjs/config`:

- `ACCESS_SECRET` - signs access tokens
- `REFRESH_SECRET` - signs refresh tokens

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
| Method | Path          | Auth   | Description             |
| ------ | ------------- | ------ | ----------------------- |
| POST   | /auth/login   | None   | Login and return tokens |
| POST   | /auth/refresh | None   | Refresh access token    |
| DELETE | /auth/logout  | None   | Revoke refresh tokens   |
| GET    | /users/me     | Bearer | Current user profile    |

## Docker
```bash
cp .env.example .env
docker compose up --build
```

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
- Users and refresh tokens live in memory and reset on restart.
- Passwords are stored in plain text (demo only).
