FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS client
WORKDIR /client
ENV CI=1 EXPO_NO_TELEMETRY=1
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run lint && npx tsc --noEmit && npm test && npx expo export --platform web

FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS backend
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -o /menu-review ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
WORKDIR /app
COPY --from=backend /menu-review /app/menu-review
COPY --from=client /client/dist /app/web
ENV PORT=8080 STATIC_DIR=/app/web
EXPOSE 8080
ENTRYPOINT ["/app/menu-review"]
