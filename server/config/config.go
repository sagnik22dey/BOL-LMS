package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	JWTSecret      string
	JWTExpiryHours int
	PostgresDSN    string
	MinioEndpoint  string
	// MinioPublicURL is the externally accessible base URL for MinIO (e.g.
	// "https://minio.example.com" or "https://storage.railway.app").  When set,
	// presigned URLs have their host/scheme rewritten to this value so that
	// browsers can reach the object storage directly.  If empty the raw URL
	// returned by the MinIO SDK (which uses MinioEndpoint) is used as-is.
	MinioPublicURL  string
	MinioAccessKey  string
	MinioSecretKey  string
	MinioUseSSL     bool
	MinioBucketVids string
	MinioBucketDocs string
	// MinioBucketLMS is the single unified bucket for the hierarchical
	// org/course storage architecture.  All org-scoped content (videos, docs,
	// assignments) is stored under prefixes inside this bucket.
	MinioBucketLMS string
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
		MinioPublicURL:  getEnv("MINIO_PUBLIC_URL", ""),
		MinioAccessKey:  getEnv("MINIO_ACCESS_KEY", ""),
		MinioSecretKey:  getEnv("MINIO_SECRET_KEY", ""),
		MinioUseSSL:     useSSL,
		MinioBucketVids: getEnv("MINIO_BUCKET_VIDEOS", "bol-lms-videos"),
		MinioBucketDocs: getEnv("MINIO_BUCKET_DOCS", "bol-lms-documents"),
		MinioBucketLMS:  getEnv("MINIO_BUCKET_LMS", "bol-lms"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
