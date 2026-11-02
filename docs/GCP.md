# Cloud Run / Cloud SQL deployment plan — not deployed

The runtime image contains a Go binary and exported Expo web assets. It runs as a non-root user, listens on the injected `PORT`, and handles SIGTERM. The PostgreSQL database must be external; Cloud Run's local filesystem is not persistent application storage.

1. Choose a GCP project, region and budget. Enable Artifact Registry, Cloud Build, Cloud Run, Cloud SQL and Secret Manager as needed.
2. Provision a PostgreSQL 17 instance and an application database. Use a dedicated runtime service account with only the needed Cloud SQL Client and Secret Manager access.
3. Store a random operator token and database connection string in Secret Manager. Store optional provider keys there too. Do not use the local Compose passwords or token.
4. Build the image using `cloudbuild.yaml` after replacing the repository/region substitutions. No automatic deployment occurs in that file.
5. Deploy the image as a **private** Cloud Run service, attach the Cloud SQL instance, and inject secrets as environment variables. Limit instances and database connections for the chosen capacity.
6. Use the Cloud SQL Unix socket path `/cloudsql/PROJECT:REGION:INSTANCE` in the pgx connection string, or a correctly configured secure private-network connection. Keep credentials out of command history.
7. For a private browser demo, use the authenticated Cloud Run proxy. The separate `X-Review-Token` header remains an application-level gate; it does not replace IAM.
8. Verify `/healthz`, authentication failure, extraction/review/save, reconnect persistence, logs without secrets, and rollback. Perform a migration review before sharing.

The sample's startup bootstrap SQL is convenient locally. Before a real deployment, use a separate migration identity and explicit versioned migrations rather than granting the serving role schema ownership. Deployment, costs, IAM configuration and mobile connectivity have not been tested here.

Official references consulted:
- https://cloud.google.com/run/docs/container-contract
- https://cloud.google.com/sql/docs/postgres/connect-run
