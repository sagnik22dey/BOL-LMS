package models

import (
	"time"

	"github.com/google/uuid"
)

// Notification is the legacy announcement model (broadcast by admins, org-scoped).
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

// UserNotification is a per-recipient, event-driven notification stored in user_notifications.
type UserNotification struct {
	ID                uuid.UUID  `json:"id"`
	RecipientID       uuid.UUID  `json:"recipient_id"`
	RecipientRole     string     `json:"recipient_role"`
	Title             string     `json:"title"`
	Message           string     `json:"message"`
	ShortSummary      string     `json:"short_summary"`
	Type              string     `json:"type"`
	Category          string     `json:"category"`
	IsRead            bool       `json:"is_read"`
	RelatedEntityID   *uuid.UUID `json:"related_entity_id,omitempty"`
	RelatedEntityType string     `json:"related_entity_type"`
	CreatedAt         time.Time  `json:"created_at"`
}

// NotificationCategory constants
const (
	NotifCategoryCourseAssignment = "course_assignment"
	NotifCategoryPurchase         = "purchase"
	NotifCategoryGeneral          = "general"
)

// NotificationRecipientRole constants
const (
	NotifRoleUser       = "user"
	NotifRoleAdmin      = "admin"
	NotifRoleSuperAdmin = "super_admin"
)
