package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Notification struct {
	ID             primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Title          string              `bson:"title" json:"title"`
	Message        string              `bson:"message" json:"message"`
	Type           string              `bson:"type" json:"type"` // e.g., "info", "warning", "success"
	OrganizationID *primitive.ObjectID `bson:"organization_id,omitempty" json:"organization_id,omitempty"` // nil means system-wide (Super Admin)
	CreatedBy      primitive.ObjectID  `bson:"created_by" json:"created_by"`
	CreatedAt      time.Time           `bson:"created_at" json:"created_at"`
}

type CreateNotificationRequest struct {
	Title   string `json:"title" binding:"required"`
	Message string `json:"message" binding:"required"`
	Type    string `json:"type" binding:"required"`
}
