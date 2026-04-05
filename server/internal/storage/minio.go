package storage

import (
	"context"
	"fmt"
	"log"
	"net/url"
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
		} else {
			log.Printf("MinIO bucket created: %s", name)
		}
	}
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
	return u.String(), nil
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
	return u.String(), nil
}
