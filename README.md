# Menu Review — Go / GraphQL / Expo / PostgreSQL

A focused reimplementation of a restaurant menu-import workflow in the technologies named in Sticker Mule's software-engineer vacancy. It is a new AI-assisted sample, not a claim of prior production Go or Expo experience.

**Photo → untrusted draft → owner review → atomic PostgreSQL save.** The sample includes a clearly labelled recorded demo so it can be reviewed without a paid AI key.

[Try the hosted menu review demo](https://menu-review.smartmade.site/). Review a scanned draft or upload a menu for manual review. The ten-item house catalog supplies illustrative photos for exact dish-name matches. Other dishes remain editable and can receive a custom photo during verification. The Docker version below adds live photo extraction and PostgreSQL persistence.

## Run the complete application

Requires Docker with Compose. No host Go or Node installation is needed.

```sh
docker compose up --build -d app
```

Open http://localhost:8780. Enter the local-only operator token `local-review-only-change-me`, then select **Try recorded demo**. Edit a name or price, set a dietary label to “Needs review” to see save validation, resolve it, and save. Reload the page, enter the token again, and select **Reload saved menus** to verify persistence.

The demo button replays recorded synthetic extraction output; it does not perform OCR. **Extract from photo** uses the actual Go vision adapter and requires a provider key supplied through the process environment or a local `.env` (see `.env.example`). PNG/JPEG images are sent to the configured provider. OpenRouter is tried first when configured, then Mistral. API calls may incur provider charges.

Stop containers with `docker compose stop`. The menu database is persisted in a named volume. The example credentials are for the loopback-only local demo, not a shared deployment.

## Run tests

Real PostgreSQL integration tests and Go race detection:

```sh
docker compose --profile test run --rm test
```

This starts a separate `menu_review_test` database, tests round-trip persistence, and forces a database constraint failure after a parent and first child insert to verify rollback. The test refuses database names that do not end in `_test`.

Client tests and type checking (Node 24):

```sh
cd client
npm ci
npm run lint
npm run typecheck
npm test
npx expo export --platform web
```

The Docker build runs the client checks too. Go unit tests can run without Postgres using `go test ./...`, but the integration test will explicitly skip unless `TEST_DATABASE_URL` is set. Do not mistake that for a complete verification run.

## What to review

| File | Responsibility |
|---|---|
| `server/internal/menu/normalize.go` | Strict output structure, three-state dietary labels, exact decimal-to-paise parsing |
| `server/internal/menu/scanner.go` | Image bounds, request context, bounded retries and fallback |
| `server/internal/api/schema.graphql` | Explicit API contract separating extraction from saving |
| `server/internal/api/graphql.go` | GraphQL resolvers, operator token, request bounds, save validation |
| `server/internal/store/postgres.go` | Transactional persistence and parameterized SQL |
| `server/internal/store/postgres_test.go` | Actual PostgreSQL round trip and rollback proof |
| `client/src/menu.ts` | Editable draft model and integer-price conversion |
| `client/App.tsx` | Expo/React review interface and saved-menu view |

Prices use integer **paise** throughout the API and database, and the UI displays **INR** consistently. Save rejects unresolved dietary labels, invalid base prices and invalid portions; it does not silently discard them. Provider requests use one bounded retry for transient failures and respect the request context. Invalid model JSON/schema invokes fallback.

## Stack coverage

- **Go + GraphQL + PostgreSQL:** implemented and tested together with a real database.
- **TypeScript + React + Expo:** one shared React Native component tree; the web export is built and browser-checked. Native Android/iOS execution is not claimed.
- **GCP:** the non-root container listens on `PORT` and includes a Cloud Build configuration and a Cloud Run/Cloud SQL deployment guide. No GCP deployment has been performed.

For native development, set `EXPO_PUBLIC_API_URL` to a backend reachable from the device before starting Expo; `localhost` on a phone refers to that phone. Use TLS and proper access controls for shared environments. This repository does not provision those environments.

## Deliberate limits

This is a single-operator sample, not a multi-tenant service. There is no user registration, fine-grained authorization, rate limiting, server-side save idempotency, durable extraction queue, or edit/delete workflow. Each successful save creates a new menu; list returns the latest 20. Duplicate dish names within the same case-sensitive category cause an atomic save failure rather than silent merging. Reload saved menus after a timeout before retrying a save.

The database schema is bootstrapped at startup for a small demo; production would use versioned migrations, a restricted database role and a separate migration step. Native-device testing, live evaluation of the new Go adapter and GCP deployment remain distinct checks. The old PHP sample's four-image results are **not** attributed to this implementation.

The Expo build dependencies pin `minimatch` 11.0.1 and `glob` 14.0.2 via explicit overrides to address the advisory returned by npm audit; validate type checks, tests and web export when changing these overrides. It is not needed in the final Go/static-web runtime image.

See [design](docs/DESIGN.md), [verification](docs/VERIFICATION.md), and [GCP deployment](docs/GCP.md).

## AI assistance and source

Implementation, tests and documentation were prepared with extensive AI coding assistance. The workflow comes from an existing Laravel billing project; this is a separate reimplementation. The recorded demo comes from the prior synthetic Mistral evaluation (provenance in `docs/recorded-demo-provenance.json`). No production tenant data or real credentials are included. The Expo template retains its bundled MIT license notice. Original contributions are published for interview review with permission, without a separate general open-source license grant.
