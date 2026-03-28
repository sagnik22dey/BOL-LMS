package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Material struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Type        string             `bson:"type" json:"type"` // video, pdf, ppt, doc, image, text
	Content     string             `bson:"content,omitempty" json:"content,omitempty"` // For text type
	FileKey     string             `bson:"file_key,omitempty" json:"file_key,omitempty"` // For MinIO files
	Duration    int                `bson:"duration_seconds,omitempty" json:"duration_seconds,omitempty"`
	Order       int                `bson:"order" json:"order"`
}

type Module struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title     string             `bson:"title" json:"title"`
	Order     int                `bson:"order" json:"order"`
	Materials []Material         `bson:"materials" json:"materials"`
}

type Course struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OrganizationID primitive.ObjectID `bson:"organization_id" json:"organization_id"`
	Title          string             `bson:"title" json:"title"`
	Description    string             `bson:"description" json:"description"`
	ThumbnailKey   string             `bson:"thumbnail_key" json:"thumbnail_key"`
	Modules        []Module           `bson:"modules" json:"modules"`
	IsPublished    bool               `bson:"is_published" json:"is_published"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
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
