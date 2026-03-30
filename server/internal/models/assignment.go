package models

import (
	"time"

	"github.com/google/uuid"
)

type Assignment struct {
	ID             uuid.UUID  `json:"id"`
	CourseID       uuid.UUID  `json:"course_id"`
	ModuleID       uuid.UUID  `json:"module_id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Deadline       *time.Time `json:"deadline,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type AssignmentSubmission struct {
	ID            uuid.UUID `json:"id"`
	AssignmentID  uuid.UUID `json:"assignment_id"`
	ModuleID      uuid.UUID `json:"module_id"`
	UserID        uuid.UUID `json:"user_id"`
	FilePath      string    `json:"file_path"`
	SubmittedAt   time.Time `json:"submitted_at"`
	RetakeAllowed bool      `json:"retake_allowed"`
}
