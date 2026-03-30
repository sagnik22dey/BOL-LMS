package models

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID             uuid.UUID  `json:"id"`
	Title          string     `json:"title"`
	Message        string     `json:"message"`
	Type           string     `json:"type"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	CreatedBy      uuid.UUID  `json:"created_by"`
	CreatedAt      time.Time  `json:"created_at"`
}

type CreateNotificationRequest struct {
	Title   string `json:"title" binding:"required"`
	Message string `json:"message" binding:"required"`
	Type    string `json:"type" binding:"required"`
}
