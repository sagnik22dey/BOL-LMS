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

	expiry, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "72"))
	useSSL, _ := strconv.ParseBool(getEnv("MINIO_USE_SSL", "false"))

	App = Config{
		Port:            getEnv("PORT", "8080"),
		JWTSecret:       getEnv("JWT_SECRET", "change_me"),
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
