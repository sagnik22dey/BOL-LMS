package models

import (
	"time"

	"github.com/google/uuid"
)

type Enrollment struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	CourseID  uuid.UUID `json:"course_id"`
	Progress  float64   `json:"progress"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type EnrollRequest struct {
	CourseID string `json:"course_id" binding:"required"`
}

type UserCourseAssignment struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	CourseID   uuid.UUID `json:"course_id"`
	AssignedBy uuid.UUID `json:"assigned_by"`
	AssignedAt time.Time `json:"assigned_at"`
}

type AssignCourseRequest struct {
	CourseIDs []string `json:"course_ids" binding:"required"`
}
