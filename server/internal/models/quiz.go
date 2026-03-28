package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type QuestionType string

const (
	QuestionMCQSingle QuestionType = "mcq_single"
	QuestionMCQMulti  QuestionType = "mcq_multi"
	QuestionWritten   QuestionType = "written"
)

type Choice struct {
	Label   string `bson:"label" json:"label"`
	IsRight bool   `bson:"is_right" json:"is_right"`
}

type Question struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Text         string             `bson:"text" json:"text"`
	Type         QuestionType       `bson:"type" json:"type"`
	Choices      []Choice           `bson:"choices,omitempty" json:"choices,omitempty"`
	CorrectIndex int                `bson:"correct_index,omitempty" json:"correct_index,omitempty"`
	Points       int                `bson:"points" json:"points"`
}

type Quiz struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CourseID       primitive.ObjectID `bson:"course_id" json:"course_id"`
	ModuleID       primitive.ObjectID `bson:"module_id" json:"module_id"`
	OrganizationID primitive.ObjectID `bson:"organization_id" json:"organization_id"`
	Title          string             `bson:"title" json:"title"`
	TimeLimitMins  int                `bson:"time_limit_mins" json:"time_limit_mins"`
	Questions      []Question         `bson:"questions" json:"questions"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type SubmissionAnswer struct {
	QuestionID      primitive.ObjectID `bson:"question_id" json:"question_id"`
	SelectedIndex   *int               `bson:"selected_index,omitempty" json:"selected_index,omitempty"`
	SelectedIndices []int              `bson:"selected_indices,omitempty" json:"selected_indices,omitempty"`
	WrittenAnswer   string             `bson:"written_answer,omitempty" json:"written_answer,omitempty"`
}

type Submission struct {
	ID            primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	QuizID        primitive.ObjectID  `bson:"quiz_id" json:"quiz_id"`
	ModuleID      primitive.ObjectID  `bson:"module_id" json:"module_id"`
	UserID        primitive.ObjectID  `bson:"user_id" json:"user_id"`
	Answers       []SubmissionAnswer  `bson:"answers" json:"answers"`
	Score         int                 `bson:"score" json:"score"`
	MaxScore      int                 `bson:"max_score" json:"max_score"`
	IsGraded      bool                `bson:"is_graded" json:"is_graded"`
	GradedBy      *primitive.ObjectID `bson:"graded_by,omitempty" json:"graded_by,omitempty"`
	StartedAt     time.Time           `bson:"started_at" json:"started_at"`
	SubmittedAt   time.Time           `bson:"submitted_at" json:"submitted_at"`
	RetakeAllowed bool                `bson:"retake_allowed" json:"retake_allowed"`
}
