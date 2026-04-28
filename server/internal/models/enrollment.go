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

// MaterialCompletion records that a user has completed a specific material item.
type MaterialCompletion struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	CourseID    uuid.UUID `json:"course_id"`
	ModuleID    uuid.UUID `json:"module_id"`
	MaterialID  uuid.UUID `json:"material_id"`
	CompletedAt time.Time `json:"completed_at"`
}

// MarkCompleteRequest is the body sent by the client when marking/unmarking a material.
type MarkCompleteRequest struct {
	CourseID   string `json:"course_id"   binding:"required"`
	ModuleID   string `json:"module_id"   binding:"required"`
	MaterialID string `json:"material_id" binding:"required"`
}

// CourseProgressResponse is returned by the GET progress endpoint.
type CourseProgressResponse struct {
	CourseID           uuid.UUID            `json:"course_id"`
	TotalMaterials     int                  `json:"total_materials"`
	CompletedMaterials int                  `json:"completed_materials"`
	ProgressPct        float64              `json:"progress_pct"` // 0–100
	Completions        []MaterialCompletion `json:"completions"`
}

// LearningGoal is an admin-assigned course goal for a specific user.
type LearningGoal struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	CourseID   uuid.UUID  `json:"course_id"`
	AssignedBy uuid.UUID  `json:"assigned_by"`
	TargetDate *time.Time `json:"target_date,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	// Enriched fields joined from other tables
	CourseTitle string  `json:"course_title,omitempty"`
	ProgressPct float64 `json:"progress_pct"`
}

// AssignLearningGoalRequest is the admin request body.
type AssignLearningGoalRequest struct {
	UserID     string  `json:"user_id"     binding:"required"`
	CourseID   string  `json:"course_id"   binding:"required"`
	TargetDate *string `json:"target_date,omitempty"`
}
