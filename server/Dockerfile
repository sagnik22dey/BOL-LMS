# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Install dependencies required for some CGO packages if needed (optional)
RUN apk add --no-cache build-base

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build the Go application
RUN CGO_ENABLED=0 GOOS=linux go build -o server_bin ./cmd/main.go

# Run stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/server_bin .

EXPOSE 8080

CMD ["./server_bin"]
