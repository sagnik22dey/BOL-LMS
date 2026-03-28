package storage

import (
	"context"
	"log"
	"net/url"
	"time"

	"bol-lms-server/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var Client *minio.Client

func Connect() {
	mc, err := minio.New(config.App.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(config.App.MinioAccessKey, config.App.MinioSecretKey, ""),
		Secure: config.App.MinioUseSSL,
	})
	if err != nil {
		log.Fatalf("MinIO client error: %v", err)
	}
	Client = mc
	log.Println("MinIO client initialized")

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
	ctx := context.Background()
	u, err := Client.PresignedPutObject(ctx, bucket, objectName, expiry)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func PresignedGetURL(bucket, objectName string, expiry time.Duration) (string, error) {
	ctx := context.Background()
	u, err := Client.PresignedGetObject(ctx, bucket, objectName, expiry, url.Values{})
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
