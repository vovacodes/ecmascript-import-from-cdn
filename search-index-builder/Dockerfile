FROM golang:1.13.5 AS build-golang
COPY . /search-index-builder
WORKDIR /search-index-builder
RUN CGO_ENABLED=0 GOOS=linux GOPROXY=https://proxy.golang.org go build -o search-index-builder main.go

FROM alpine:latest
# mailcap adds mime detection and ca-certificates help with TLS (basic stuff)
RUN apk --no-cache add ca-certificates mailcap && addgroup -S search-index-builder && adduser -S search-index-builder -G search-index-builder
USER search-index-builder
WORKDIR /search-index-builder
COPY --from=build-golang /search-index-builder/search-index-builder .

ENTRYPOINT ["./search-index-builder"]
