package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func CreateAssignment(c *gin.Context) {
	orgID, _ := primitive.ObjectIDFromHex(c.GetString("org_id"))
	courseID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}
	moduleID, err := primitive.ObjectIDFromHex(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module id"})
		return
	}

	var assignment models.Assignment
	if err := c.ShouldBindJSON(&assignment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignment.ID = primitive.NewObjectID()
	assignment.CourseID = courseID
	assignment.ModuleID = moduleID
	assignment.OrganizationID = orgID
	assignment.CreatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("assignments").InsertOne(ctx, assignment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create assignment"})
		return
	}
	c.JSON(http.StatusCreated, assignment)
}

func SubmitAssignment(c *gin.Context) {
	assignmentID, err := primitive.ObjectIDFromHex(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	var payload struct {
		FilePath string `json:"file_path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var assignment models.Assignment
	if err := db.Collection("assignments").FindOne(ctx, bson.M{"_id": assignmentID}).Decode(&assignment); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return
	}

	var existing models.AssignmentSubmission
	err = db.Collection("assignment_submissions").FindOne(ctx, bson.M{"assignment_id": assignmentID, "user_id": userID}).Decode(&existing)
	if err == nil {
		if !existing.RetakeAllowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "assignment already submitted"})
			return
		}
	}

	submission := models.AssignmentSubmission{
		ID:           primitive.NewObjectID(),
		AssignmentID: assignmentID,
		ModuleID:     assignment.ModuleID,
		UserID:       userID,
		FilePath:     payload.FilePath,
		SubmittedAt:  time.Now(),
	}

	if existing.ID != primitive.NilObjectID {
		submission.ID = existing.ID
		_, err = db.Collection("assignment_submissions").ReplaceOne(ctx, bson.M{"_id": existing.ID}, submission)
	} else {
		_, err = db.Collection("assignment_submissions").InsertOne(ctx, submission)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save assignment submission"})
		return
	}
	c.JSON(http.StatusCreated, submission)
}

func ResetAssignment(c *gin.Context) {
	assignmentID, err := primitive.ObjectIDFromHex(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	userID, err := primitive.ObjectIDFromHex(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{"$set": bson.M{"retake_allowed": true}}
	_, err = db.Collection("assignment_submissions").UpdateOne(ctx, bson.M{"assignment_id": assignmentID, "user_id": userID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reset assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "assignment reset for retake"})
}

func GetModuleAssessments(c *gin.Context) {
	moduleID, err := primitive.ObjectIDFromHex(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	quizzes := make([]models.Submission, 0)
	quizCursor, _ := db.Collection("submissions").Find(ctx, bson.M{"module_id": moduleID})
	quizCursor.All(ctx, &quizzes)

	assignments := make([]models.AssignmentSubmission, 0)
	assignCursor, _ := db.Collection("assignment_submissions").Find(ctx, bson.M{"module_id": moduleID})
	assignCursor.All(ctx, &assignments)

	c.JSON(http.StatusOK, gin.H{
		"quizzes":     quizzes,
		"assignments": assignments,
	})
}

func GetAssignment(c *gin.Context) {
	assignmentID, err := primitive.ObjectIDFromHex(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var assignment models.Assignment
	if err := db.Collection("assignments").FindOne(ctx, bson.M{"_id": assignmentID}).Decode(&assignment); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return
	}

	c.JSON(http.StatusOK, assignment)
}

func GetMyAssignmentSubmission(c *gin.Context) {
	assignmentID, err := primitive.ObjectIDFromHex(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.AssignmentSubmission
	err = db.Collection("assignment_submissions").FindOne(ctx, bson.M{"assignment_id": assignmentID, "user_id": userID}).Decode(&existing)
	if err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}

	c.JSON(http.StatusOK, existing)
}
