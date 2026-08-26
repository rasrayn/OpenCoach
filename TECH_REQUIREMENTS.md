# Technical Requirements

## Purpose

This file documents the technologies, versions, runtime assumptions, and external services required by the project.

It has a different purpose from `MODIFICACION.md`:

- `MODIFICACION.md` is a learning and implementation diary.
- `TECH_REQUIREMENTS.md` is the technical contract for running, testing, and deploying the project.

No real secrets, credentials, private keys, or local-only values should be stored here.

---

## Version Sources

Use these files as the source of truth depending on the kind of requirement:

- `package-lock.json`: exact installed npm package versions.
- `package.json`: declared npm dependency ranges and project scripts.
- `.env.example`: expected environment variables without real secrets.
- `.kiro/specs/user-authentication-login/design.md`: architectural technology choices.
- `.kiro/specs/user-authentication-login/requirements.md`: functional and security requirements.

When a version is not yet pinned in the repository, this document marks it as `TBD` instead of inventing a value.

---

## Runtime

| Technology | Current / Required Version | Source | Notes |
|---|---:|---|---|
| Node.js runtime | local observed: `24.11.0` | `node -v` | The project does not yet enforce this with `engines` or `.nvmrc`. |
| Node.js API types | `20.19.43` | `package-lock.json` | The code is currently typed against Node 20 APIs via `@types/node`. |
| npm | local observed: `11.6.2` | `npm -v` | Used for scripts, dependency installation, and lockfile management. |
| TypeScript target | `ES2020` | `tsconfig.json` | Runtime output is CommonJS. |
| TypeScript strict mode | enabled | `tsconfig.json` | `strict`, `noImplicitAny`, and `noImplicitReturns` are enabled. |

Recommended next hardening step:

```json
"engines": {
  "node": ">=20"
}
```

Optionally add `.nvmrc` or another runtime-version file once the deployment target is decided.

---

## npm Dependencies

### Runtime Dependencies

There are currently no installed runtime dependencies in `package.json`.

Some infrastructure classes are intentionally lightweight or stubbed while the implementation plan advances. Production adapters for PostgreSQL, Redis, email, and bcrypt may require runtime dependencies in later tasks.

### Development Dependencies

Exact installed versions from `package-lock.json`:

| Package | Exact Version | Declared Range |
|---|---:|---:|
| `typescript` | `5.9.3` | `^5.4.5` |
| `jest` | `29.7.0` | `^29.7.0` |
| `ts-jest` | `29.4.12` | `^29.1.4` |
| `fast-check` | `3.23.2` | `^3.19.0` |
| `@types/node` | `20.19.43` | `^20.14.0` |
| `@types/jest` | `29.5.14` | `^29.5.12` |

Important distinction:

- The declared range allows compatible updates.
- The lockfile pins the exact version installed in this workspace.

---

## Testing Stack

| Technology | Version / Requirement | Source | Notes |
|---|---:|---|---|
| Jest | `29.7.0` | `package-lock.json` | Main test runner. |
| ts-jest | `29.4.12` | `package-lock.json` | TypeScript transform for Jest. |
| fast-check | `3.23.2` | `package-lock.json` | Property-based testing library. |
| Test environment | `node` | `package.json` | Jest runs tests in Node. |

Project test scripts:

```bash
npm test
npm run typecheck
npm run build
```

Property-based tests should run at least 100 iterations when the task explicitly requires it.

---

## Database

| Technology | Version / Requirement | Source | Notes |
|---|---:|---|---|
| PostgreSQL | `TBD` | design docs | Required for persistent users, tokens, profiles, and audit logs. |
| PostgreSQL npm client | `TBD` | implementation pending | No `pg` dependency is installed yet. |

Current implementation status:

- Repository classes are written against a small `DbPool` interface.
- SQL migrations exist under `src/modules/auth/infrastructure/persistence/migrations`.
- A real PostgreSQL pool still needs to be wired for production.

Recommended next hardening step:

- Decide and pin a PostgreSQL major version before production deployment.
- Add the actual PostgreSQL client dependency when the project starts running against a real database.

---

## Cache and Rate Limiting

| Technology | Version / Requirement | Source | Notes |
|---|---:|---|---|
| Redis | `TBD` | design docs | Required for production-grade rate limiting and shared session/token cache behavior. |
| Redis npm client | `TBD` | implementation pending | No Redis client dependency is installed yet. |

Current implementation status:

- `RedisRateLimitService` defines the rate-limiting behavior.
- Local development and tests can use an in-memory store.
- Production currently requires a shared atomic Redis store.

Production Redis requirements:

- Shared across all application instances.
- Atomic operations for sliding-window rate limiting.
- Prefer transactions or Lua scripts for multi-step rate-limit updates.

---

## Security Requirements

| Area | Requirement | Source | Notes |
|---|---|---|---|
| Password hashing | bcrypt with cost factor `>= 12` | requirements/design | Implementation dependency is still pending. |
| Access tokens | JWT signed with `RS256` | design/tasks | Current implementation uses Node `crypto`, no external JWT package. |
| Access token duration | 15 minutes | requirements/design | Implemented in `TokenService`. |
| Refresh token storage | Opaque token stored as SHA-256 hash | implementation/design | Plain refresh tokens must never be stored. |
| Admin refresh token duration | 1 day | requirements/design | Implemented in `TokenService`. |
| Coach refresh token duration | 7 days | requirements/design | Implemented in `TokenService`. |
| Athlete refresh token duration | no fixed expiration | requirements/design | Revocation still applies. |
| Transport security | HTTPS / TLS 1.2+ | requirements/design | Deployment requirement. |

Private key material must not be committed.

Expected local configuration references:

```env
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

These are paths only. The actual key files must stay out of git.

---

## Email

| Technology | Version / Requirement | Source | Notes |
|---|---:|---|---|
| Email provider / SMTP server | `TBD` | design docs | Required for verification, credentials, and password reset flows. |
| Email npm client | `TBD` | implementation pending | `NodemailerEmailService` exists as an adapter name, but no package is installed yet. |

Expected environment variables are documented in `.env.example`.

No real SMTP credentials should be committed.

---

## Environment Variables

Expected variables are documented in `.env.example`:

```env
PORT
NODE_ENV
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
JWT_PRIVATE_KEY_PATH
JWT_PUBLIC_KEY_PATH
EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASSWORD
EMAIL_FROM
CORS_ORIGINS
```

Rules:

- `.env.example` may be committed with safe example values.
- `.env` must remain local and uncommitted.
- Real passwords, API keys, SMTP credentials, database URLs, Redis passwords, and private keys must not be committed.

---

## Pending Version Decisions

These technologies are required by the architecture but do not yet have pinned versions in the repository:

| Technology | Decision Needed |
|---|---|
| PostgreSQL | Choose production major version. |
| Redis | Choose production major version. |
| PostgreSQL npm client | Choose package and version, likely when real DB wiring starts. |
| Redis npm client | Choose package and version, likely when production rate limiting is wired. |
| bcrypt implementation package | Choose package and version during UserService/password hashing implementation. |
| SMTP/email package | Choose package and version when email sending is implemented for real. |
| Node.js runtime policy | Decide whether to target Node 20, 22, or 24 and enforce it with `engines` / `.nvmrc`. |

Until these are decided, the project should avoid pretending they are fixed.

---

## Update Rules

Update this file when:

- a new runtime dependency is added;
- a major version changes;
- a production infrastructure service is selected;
- an environment variable is added, renamed, or removed;
- a security-relevant technology changes;
- the Node.js runtime target is enforced.

Do not use this file as a changelog. Use `MODIFICACION.md` for the learning diary and implementation explanations.
