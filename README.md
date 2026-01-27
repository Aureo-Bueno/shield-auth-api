# NestJS JWT Auth API

A small NestJS API that demonstrates JWT access and refresh tokens with an in-memory user store and Swagger docs.

## What this project does
- Provides login, refresh, logout, and a protected profile endpoint
- Issues access tokens that expire in 1 hour
- Stores refresh tokens in memory with IP and user-agent metadata
- Exposes Swagger UI at `/docs`
- Includes unit and integration tests with Jest

## How it works
1. Login (`POST /auth/login`) looks up the user by email in the in-memory list and compares the plain-text password. On success it creates a refresh token (signed with `REFRESH_SECRET`) and an access token (signed with `ACCESS_SECRET`, 1h expiry).
2. Refresh (`POST /auth/refresh`) verifies the refresh token signature, checks it is still in memory, and returns a new access token.
3. Logout (`DELETE /auth/logout`) removes refresh tokens from memory. The current implementation clears the in-memory list, which invalidates all refresh tokens.
4. Protected profile (`GET /users/me`) requires `Authorization: Bearer <access token>`; the JWT strategy extracts `userId` and the controller returns that user.

## Quick start
```bash
yarn install
cp .env.example .env
yarn start:dev
```

Open `http://localhost:3000/docs` for the Swagger UI.

## Environment variables
The app reads secrets from `.env` via `@nestjs/config`:

- `ACCESS_SECRET` - used to sign access tokens
- `REFRESH_SECRET` - used to sign refresh tokens

## Sample users (in memory)
These are defined in `UsersService` for demo purposes:

| id | name  | email           | password  |
| -- | ----- | --------------- | --------- |
| 0  | Aureo | aureo@gmail.com | aureopass |
| 1  | Bueno | bueno@gmail.com | buenopass |

## API endpoints
| Method | Path          | Auth   | Description             |
| ------ | ------------- | ------ | ----------------------- |
| POST   | /auth/login   | None   | Login and return tokens |
| POST   | /auth/refresh | None   | Refresh access token    |
| DELETE | /auth/logout  | None   | Revoke refresh tokens   |
| GET    | /users/me     | Bearer | Current user profile    |

## Notes
- Users and refresh tokens live in memory and reset on restart.
- Passwords are stored in plain text (demo only).

## Tests
```bash
yarn test
yarn test:unit
yarn test:integration
yarn test:e2e
yarn test:cov
```

## Test coverage (yarn run test:cov)
```
yarn run v1.22.22
$ jest --coverage
 PASS  src/auth/auth.controller.spec.ts
 PASS  src/users/users.controller.spec.ts
 PASS  src/auth/strategies/jwt.strategy.spec.ts
 PASS  src/auth/auth.service.spec.ts
 PASS  src/auth/guards/jwt-auth.guard.spec.ts
 PASS  src/users/users.service.spec.ts
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |   96.55 |    76.08 |     100 |   95.94 |
 auth                 |   94.33 |       75 |     100 |   93.75 |
  auth.controller.ts  |     100 |       75 |     100 |     100 | 15-42
  auth.service.ts     |    92.1 |       75 |     100 |   91.42 | 21,35,86
 auth/guards          |     100 |      100 |     100 |     100 |
  jwt-auth.guard.ts   |     100 |      100 |     100 |     100 |
 auth/strategies      |     100 |      100 |     100 |     100 |
  jwt.strategy.ts     |     100 |      100 |     100 |     100 |
 users                |     100 |       75 |     100 |     100 |
  users.controller.ts |     100 |       75 |     100 |     100 | 14
  users.service.ts    |     100 |       75 |     100 |     100 | 26
----------------------|---------|----------|---------|---------|-------------------

Test Suites: 6 passed, 6 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        1.327 s
Ran all test suites.
Done in 1.67s.
```
