FROM golang:1.23-alpine AS builder
WORKDIR /build
ENV GOTOOLCHAIN=auto
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o promptlib-backend .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/promptlib-backend .
ENV PORT=8080
EXPOSE 8080
CMD ["./promptlib-backend"]
