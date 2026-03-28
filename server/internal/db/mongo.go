package db

import (
	"context"
	"log"
	"time"

	"bol-lms-server/config"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client

func Connect() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(config.App.MongoURI))
	if err != nil {
		log.Fatalf("MongoDB connection error: %v", err)
	}
	if err = client.Ping(ctx, nil); err != nil {
		log.Fatalf("MongoDB ping error: %v", err)
	}

	Client = client
	log.Println("MongoDB connected successfully")
}

func Database() *mongo.Database {
	return Client.Database(config.App.MongoDB)
}

func Collection(name string) *mongo.Collection {
	return Database().Collection(name)
}
