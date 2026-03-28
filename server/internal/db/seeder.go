package db

import (
	"context"
	"log"
	"os"
	"time"

	"bol-lms-server/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

func SeedDummyAccounts() {
	users := []struct {
		Email    string
		Password string
		Name     string
		Role     models.Role
	}{
		{
			Email:    os.Getenv("DUMMY_SUPERADMIN_EMAIL"),
			Password: os.Getenv("DUMMY_SUPERADMIN_PASSWORD"),
			Name:     "Super Admin",
			Role:     models.RoleSuperAdmin,
		},
		{
			Email:    os.Getenv("DUMMY_ADMIN_EMAIL"),
			Password: os.Getenv("DUMMY_ADMIN_PASSWORD"),
			Name:     "Admin Account",
			Role:     models.RoleAdmin,
		},
		{
			Email:    os.Getenv("DUMMY_USER_EMAIL"),
			Password: os.Getenv("DUMMY_USER_PASSWORD"),
			Name:     "Student User",
			Role:     models.RoleUser,
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	col := Collection("users")

	for _, u := range users {
		if u.Email == "" || u.Password == "" {
			continue
		}

		var existing models.User
		if err := col.FindOne(ctx, bson.M{"email": u.Email}).Decode(&existing); err == nil {
			continue // Already exists
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash password for %s", u.Email)
			continue
		}

		user := models.User{
			ID:           primitive.NewObjectID(),
			Name:         u.Name,
			Email:        u.Email,
			PasswordHash: string(hash),
			Role:         u.Role,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		if _, err := col.InsertOne(ctx, user); err != nil {
			log.Printf("Failed to seed user %s", u.Email)
		} else {
			log.Printf("Seeded dummy account: %s (Role: %s)", u.Email, u.Role)
		}
	}
}
