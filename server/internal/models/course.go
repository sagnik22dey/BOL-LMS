package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Material struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Type        string    `json:"type"`
	Content     string    `json:"content,omitempty"`
	FileKey     string    `json:"file_key,omitempty"`
	Duration    int       `json:"duration_seconds,omitempty"`
	Order       int       `json:"order"`
}

type Module struct {
	ID        uuid.UUID  `json:"id"`
	Title     string     `json:"title"`
	Order     int        `json:"order"`
	Materials []Material `json:"materials"`
}

type Course struct {
	ID             uuid.UUID       `json:"id"`
	OrganizationID uuid.UUID       `json:"organization_id"`
	Title          string          `json:"title"`
	Description    string          `json:"description"`
	ThumbnailKey   string          `json:"thumbnail_key"`
	Modules        []Module        `json:"modules"`
	RawModules     json.RawMessage `json:"-"`
	IsPublished    bool            `json:"is_published"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type CreateCourseRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
}

type PresignRequest struct {
	Bucket     string `json:"bucket" binding:"required"`
	ObjectName string `json:"object_name" binding:"required"`
	ExpiryMins int    `json:"expiry_mins"`
}
