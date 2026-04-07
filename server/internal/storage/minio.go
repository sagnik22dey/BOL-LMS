package storage

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"bol-lms-server/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var Client *minio.Client

func Connect() {
	// SEC-004: Do not log the actual access key value — log only its length.
	log.Printf("[minio] endpoint=%q useSSL=%v accessKeyLen=%d secretKeyLen=%d bucketVids=%q bucketDocs=%q",
		config.App.MinioEndpoint,
		config.App.MinioUseSSL,
		len(config.App.MinioAccessKey),
		len(config.App.MinioSecretKey),
		config.App.MinioBucketVids,
		config.App.MinioBucketDocs,
	)

	if config.App.MinioAccessKey == "" || config.App.MinioSecretKey == "" {
		log.Println("[minio] WARNING: MINIO_ACCESS_KEY or MINIO_SECRET_KEY is empty — presigned URL generation will fail")
	}

	mc, err := minio.New(config.App.MinioEndpoint, &minio.Options{
		Creds:        credentials.NewStaticV4(config.App.MinioAccessKey, config.App.MinioSecretKey, ""),
		Secure:       config.App.MinioUseSSL,
		Region:       "us-east-1",
		BucketLookup: minio.BucketLookupPath,
	})
	if err != nil {
		log.Fatalf("MinIO client error: %v", err)
	}
	Client = mc
	log.Println("[minio] client initialized")

	ensureBucket(config.App.MinioBucketVids)
	ensureBucket(config.App.MinioBucketDocs)

	// Initialise the unified hierarchical LMS bucket.
	InitLMSBucket()
}

func ensureBucket(name string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := Client.BucketExists(ctx, name)
	if err != nil {
		log.Printf("MinIO bucket check error (%s): %v", name, err)
		return
	}
	if !exists {
		if err = Client.MakeBucket(ctx, name, minio.MakeBucketOptions{}); err != nil {
			log.Printf("MinIO bucket create error (%s): %v", name, err)
			return
		}
		log.Printf("MinIO bucket created: %s", name)
	}
}

// rewritePresignedURL replaces the scheme+host in a MinIO-generated presigned
// URL with the externally accessible public URL configured via MINIO_PUBLIC_URL.
//
// Why this is needed: the MinIO Go SDK embeds the endpoint passed to minio.New()
// into the generated presigned URL.  In containerised / Railway deployments that
// endpoint is an *internal* hostname (e.g. "minio.railway.internal:9000") which
// is unreachable from a browser.  Setting MINIO_PUBLIC_URL to the externally
// reachable base URL (e.g. "https://minio.example.com") causes the path,
// signature and all other query parameters to be preserved while only the
// host/scheme are swapped — the HMAC signature remains valid because MinIO
// validates only the signing inputs, not the transport host.
func rewritePresignedURL(rawURL string) (string, error) {
	pub := strings.TrimRight(config.App.MinioPublicURL, "/")
	if pub == "" {
		// No public URL configured — return as-is (works when endpoint IS public).
		return rawURL, nil
	}

	pubParsed, err := url.Parse(pub)
	if err != nil {
		return rawURL, fmt.Errorf("MINIO_PUBLIC_URL is not a valid URL: %w", err)
	}

	generated, err := url.Parse(rawURL)
	if err != nil {
		return rawURL, fmt.Errorf("could not parse generated presigned URL: %w", err)
	}

	// Swap scheme and host; keep path + query (signature) intact.
	generated.Scheme = pubParsed.Scheme
	generated.Host = pubParsed.Host

	rewritten := generated.String()
	log.Printf("[minio] presigned URL rewritten: internal_host=%q → public_host=%q", pubParsed.Host, generated.Host)
	return rewritten, nil
}

func PresignedPutURL(bucket, objectName string, expiry time.Duration) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("minio client is not initialized")
	}
	if config.App.MinioAccessKey == "" || config.App.MinioSecretKey == "" {
		return "", fmt.Errorf("minio credentials are not configured (MINIO_ACCESS_KEY / MINIO_SECRET_KEY are empty)")
	}
	ctx := context.Background()
	u, err := Client.PresignedPutObject(ctx, bucket, objectName, expiry)
	if err != nil {
		log.Printf("[minio] PresignedPutObject error bucket=%q object=%q: %v", bucket, objectName, err)
		return "", err
	}
	log.Printf("[presign] bucket=%q object=%q expiry=%v raw_host=%q", bucket, objectName, expiry, u.Host)
	return rewritePresignedURL(u.String())
}

func PresignedGetURL(bucket, objectName string, expiry time.Duration) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("minio client is not initialized")
	}
	ctx := context.Background()
	u, err := Client.PresignedGetObject(ctx, bucket, objectName, expiry, url.Values{})
	if err != nil {
		log.Printf("[minio] PresignedGetObject error bucket=%q object=%q: %v", bucket, objectName, err)
		return "", err
	}
	log.Printf("[presign] bucket=%q object=%q expiry=%v raw_host=%q", bucket, objectName, expiry, u.Host)
	return rewritePresignedURL(u.String())
}
