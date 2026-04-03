package db

import (
	"context"
	"errors"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type seedUser struct {
	Email    string
	Password string
	Name     string
	Role     string
}

func SeedDummyAccounts() {
	users := []seedUser{
		{
			Email:    os.Getenv("DUMMY_SUPERADMIN_EMAIL"),
			Password: os.Getenv("DUMMY_SUPERADMIN_PASSWORD"),
			Name:     "Super Admin",
			Role:     "super_admin",
		},
		{
			Email:    os.Getenv("DUMMY_ADMIN_EMAIL"),
			Password: os.Getenv("DUMMY_ADMIN_PASSWORD"),
			Name:     "Admin Account",
			Role:     "admin",
		},
		{
			Email:    os.Getenv("DUMMY_USER_EMAIL"),
			Password: os.Getenv("DUMMY_USER_PASSWORD"),
			Name:     "Student User",
			Role:     "user",
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, u := range users {
		if u.Email == "" || u.Password == "" {
			log.Printf("Skipping seed entry with missing email or password (role: %s)", u.Role)
			continue
		}

		var existingID string
		err := Pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, u.Email).Scan(&existingID)
		if err == nil {
			// User already exists – skip to avoid duplicate creation.
			log.Printf("Seed account already exists, skipping: %s (role: %s)", u.Email, u.Role)
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			// Unexpected DB error – skip creation rather than risk a bad insert.
			log.Printf("Error checking existence of seed user %s: %v", u.Email, err)
			continue
		}

		// pgx.ErrNoRows: user does not exist yet, safe to create.
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash password for %s: %v", u.Email, err)
			continue
		}

		now := time.Now()
		_, err = Pool.Exec(ctx,
			`INSERT INTO users (id, name, email, password_hash, role, is_suspended, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)`,
			uuid.New(), u.Name, u.Email, string(hash), u.Role, now, now,
		)
		if err != nil {
			log.Printf("Failed to seed user %s: %v", u.Email, err)
		} else {
			log.Printf("Seeded dummy account: %s (role: %s)", u.Email, u.Role)
		}
	}
}
