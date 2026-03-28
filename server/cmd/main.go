package main

import (
	"log"

	"bol-lms-server/config"
	"bol-lms-server/internal/db"
	"bol-lms-server/internal/router"
	"bol-lms-server/internal/storage"
	"bol-lms-server/internal/ws"
)

func main() {
	config.Load()
	db.Connect()
	db.SeedDummyAccounts()
	storage.Connect()
	ws.Init()

	r := router.Setup()
	log.Printf("Server starting on port %s", config.App.Port)
	if err := r.Run(":" + config.App.Port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
