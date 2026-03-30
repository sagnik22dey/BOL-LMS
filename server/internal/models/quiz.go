package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type QuestionType string

const (
	QuestionMCQSingle QuestionType = "mcq_single"
	QuestionMCQMulti  QuestionType = "mcq_multi"
	QuestionWritten   QuestionType = "written"
)

type Choice struct {
	Label   string `json:"label"`
	IsRight bool   `json:"is_right"`
}

type Question struct {
	ID           uuid.UUID    `json:"id"`
	Text         string       `json:"text"`
	Type         QuestionType `json:"type"`
	Choices      []Choice     `json:"choices,omitempty"`
	CorrectIndex int          `json:"correct_index,omitempty"`
	Points       int          `json:"points"`
}

type Quiz struct {
	ID             uuid.UUID       `json:"id"`
	CourseID       uuid.UUID       `json:"course_id"`
	ModuleID       uuid.UUID       `json:"module_id"`
	OrganizationID uuid.UUID       `json:"organization_id"`
	Title          string          `json:"title"`
	TimeLimitMins  int             `json:"time_limit_mins"`
	Questions      []Question      `json:"questions"`
	RawQuestions   json.RawMessage `json:"-"`
	CreatedAt      time.Time       `json:"created_at"`
}

type SubmissionAnswer struct {
	QuestionID      uuid.UUID `json:"question_id"`
	SelectedIndex   *int      `json:"selected_index,omitempty"`
	SelectedIndices []int     `json:"selected_indices,omitempty"`
	WrittenAnswer   string    `json:"written_answer,omitempty"`
}

type Submission struct {
	ID            uuid.UUID          `json:"id"`
	QuizID        uuid.UUID          `json:"quiz_id"`
	ModuleID      uuid.UUID          `json:"module_id"`
	UserID        uuid.UUID          `json:"user_id"`
	Answers       []SubmissionAnswer `json:"answers"`
	Score         int                `json:"score"`
	MaxScore      int                `json:"max_score"`
	IsGraded      bool               `json:"is_graded"`
	GradedBy      *uuid.UUID         `json:"graded_by,omitempty"`
	StartedAt     time.Time          `json:"started_at"`
	SubmittedAt   *time.Time         `json:"submitted_at,omitempty"`
	RetakeAllowed bool               `json:"retake_allowed"`
}
