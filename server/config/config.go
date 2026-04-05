package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	JWTSecret       string
	JWTExpiryHours  int
	PostgresDSN     string
	MinioEndpoint   string
	MinioAccessKey  string
	MinioSecretKey  string
	MinioUseSSL     bool
	MinioBucketVids string
	MinioBucketDocs string
}

var App Config

func Load() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	// SEC-001: Refuse to start with a missing or default JWT secret.
	// A predictable secret allows any attacker to forge valid tokens.
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable must be set to a strong random value")
	}

	expiry, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))
	useSSL, _ := strconv.ParseBool(getEnv("MINIO_USE_SSL", "false"))

	App = Config{
		Port:            getEnv("PORT", "8080"),
		JWTSecret:       jwtSecret,
		JWTExpiryHours:  expiry,
		PostgresDSN:     getEnv("POSTGRES_DSN", ""),
		MinioEndpoint:   getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey:  getEnv("MINIO_ACCESS_KEY", ""),
		MinioSecretKey:  getEnv("MINIO_SECRET_KEY", ""),
		MinioUseSSL:     useSSL,
		MinioBucketVids: getEnv("MINIO_BUCKET_VIDEOS", "bol-lms-videos"),
		MinioBucketDocs: getEnv("MINIO_BUCKET_DOCS", "bol-lms-documents"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
