package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Assignment struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CourseID       primitive.ObjectID `bson:"course_id" json:"course_id"`
	ModuleID       primitive.ObjectID `bson:"module_id" json:"module_id"`
	OrganizationID primitive.ObjectID `bson:"organization_id" json:"organization_id"`
	Title          string             `bson:"title" json:"title"`
	Description    string             `bson:"description" json:"description"`
	Deadline       *time.Time         `bson:"deadline,omitempty" json:"deadline,omitempty"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type AssignmentSubmission struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	AssignmentID  primitive.ObjectID `bson:"assignment_id" json:"assignment_id"`
	ModuleID      primitive.ObjectID `bson:"module_id" json:"module_id"`
	UserID        primitive.ObjectID `bson:"user_id" json:"user_id"`
	FilePath      string             `bson:"file_path" json:"file_path"`
	SubmittedAt   time.Time          `bson:"submitted_at" json:"submitted_at"`
	RetakeAllowed bool               `bson:"retake_allowed" json:"retake_allowed"`
}
