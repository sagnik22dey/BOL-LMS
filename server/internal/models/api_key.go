package models

import (
	"time"

	"github.com/google/uuid"
)

// CourseAPIKey represents a secret key tied to a specific course.
// Third-party website owners use this key to trigger course access
// provisioning on behalf of their customers.
type CourseAPIKey struct {
	ID          uuid.UUID  `json:"id"`
	CourseID    uuid.UUID  `json:"course_id"`
	CourseTitle string     `json:"course_title,omitempty"`
	Key         string     `json:"key"`
	Label       string     `json:"label"`
	IsActive    bool       `json:"is_active"`
	CreatedBy   uuid.UUID  `json:"created_by"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// GenerateAPIKeyRequest is the payload for the key-generation endpoint.
type GenerateAPIKeyRequest struct {
	CourseID string `json:"course_id" binding:"required"`
	Label    string `json:"label"`
}

// ProvisionAccessRequest is the payload third-party websites POST to grant
// a purchasing user access to the course identified by the API key.
type ProvisionAccessRequest struct {
	// Email of the purchasing user. If no LMS account exists one will be
	// created automatically with a random secure password.
	Email string `json:"email" binding:"required,email"`
	// Name is used only when creating a new user account.
	Name string `json:"name"`
}

// ProvisionAccessResponse is returned to the third-party after a successful
// access-provisioning call.
type ProvisionAccessResponse struct {
	UserID     uuid.UUID `json:"user_id"`
	CourseID   uuid.UUID `json:"course_id"`
	Email      string    `json:"email"`
	IsNewUser  bool      `json:"is_new_user"`
	AssignedAt time.Time `json:"assigned_at"`
}
