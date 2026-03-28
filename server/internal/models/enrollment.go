package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Enrollment struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	CourseID  primitive.ObjectID `bson:"course_id" json:"course_id"`
	Progress  float64            `bson:"progress" json:"progress"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type EnrollRequest struct {
	CourseID string `json:"course_id" binding:"required"`
}

type UserCourseAssignment struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID     primitive.ObjectID `bson:"user_id" json:"user_id"`
	CourseID   primitive.ObjectID `bson:"course_id" json:"course_id"`
	AssignedBy primitive.ObjectID `bson:"assigned_by" json:"assigned_by"` // Admin who assigned
	AssignedAt time.Time          `bson:"assigned_at" json:"assigned_at"`
}

type AssignCourseRequest struct {
	CourseIDs []string `json:"course_ids" binding:"required"`
}
