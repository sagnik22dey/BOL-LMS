package models

import (
	"time"

	"github.com/google/uuid"
)

type Group struct {
	ID             uuid.UUID   `json:"id"`
	OrganizationID uuid.UUID   `json:"organization_id"`
	Name           string      `json:"name"`
	Description    string      `json:"description"`
	CourseIDs      []uuid.UUID `json:"course_ids"`
	UserIDs        []uuid.UUID `json:"user_ids"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type CreateGroupRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type UpdateGroupRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type AddUsersToGroupRequest struct {
	UserIDs []string `json:"user_ids" binding:"required"`
}

type AssignCoursesToGroupRequest struct {
	CourseIDs []string `json:"course_ids" binding:"required"`
}
