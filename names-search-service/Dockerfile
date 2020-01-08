FROM golang:1.13.5 AS build-golang
COPY . /names-search-service
WORKDIR /names-search-service
RUN CGO_ENABLED=0 GOOS=linux GOPROXY=https://proxy.golang.org go build -o names-search-service main.go

FROM alpine:latest
# mailcap adds mime detection and ca-certificates help with TLS (basic stuff)
RUN apk --no-cache add ca-certificates mailcap tzdata

# Fix the timezone
ENV TZ=Europe/Amsterdam
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN addgroup -S names-search-service && adduser -S names-search-service -G names-search-service
USER names-search-service
WORKDIR /names-search-service
COPY --from=build-golang /names-search-service/names-search-service .
COPY ./entrypoint.sh .

ENTRYPOINT ["./entrypoint.sh"]
