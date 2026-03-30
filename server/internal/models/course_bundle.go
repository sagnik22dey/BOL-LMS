package models

import (
	"time"

	"github.com/google/uuid"
)

type CourseBundle struct {
	ID             uuid.UUID   `json:"id"`
	OrganizationID uuid.UUID   `json:"organization_id"`
	Name           string      `json:"name"`
	Description    string      `json:"description"`
	CourseIDs      []uuid.UUID `json:"course_ids"`
	UserIDs        []uuid.UUID `json:"user_ids"`
	Price          int         `json:"price"`
	Currency       string      `json:"currency"`
	ValidityDays   *int        `json:"validity_days,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type CreateCourseBundleRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	Price        int    `json:"price"`
	Currency     string `json:"currency"`
	ValidityDays *int   `json:"validity_days,omitempty"`
}

type UpdateCourseBundleRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	Price        int    `json:"price"`
	Currency     string `json:"currency"`
	ValidityDays *int   `json:"validity_days,omitempty"`
}

type AddUsersToCourseBundleRequest struct {
	UserIDs []string `json:"user_ids" binding:"required"`
}

type AssignCoursesToCourseBundleRequest struct {
	CourseIDs []string `json:"course_ids" binding:"required"`
}
