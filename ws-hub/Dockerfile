FROM golang:1.23-alpine AS builder

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/ws-hub .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && adduser -D -H appuser
USER appuser

COPY --from=builder /out/ws-hub /usr/local/bin/ws-hub

EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/ws-hub"]
