package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Group struct {
	ID             primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	OrganizationID primitive.ObjectID   `bson:"organization_id" json:"organization_id"`
	Name           string               `bson:"name" json:"name"`
	Description    string               `bson:"description" json:"description"`
	CourseIDs      []primitive.ObjectID `bson:"course_ids" json:"course_ids"`
	UserIDs        []primitive.ObjectID `bson:"user_ids" json:"user_ids"`
	CreatedAt      time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time            `bson:"updated_at" json:"updated_at"`
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
