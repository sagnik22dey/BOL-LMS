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

func EnrollUser(c *gin.Context) {
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	var req models.EnrollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := primitive.ObjectIDFromHex(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.Enrollment
	err = db.Collection("enrollments").FindOne(ctx, bson.M{
		"user_id":   userID,
		"course_id": courseID,
	}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "already enrolled"})
		return
	}

	var course models.Course
	if err := db.Collection("courses").FindOne(ctx, bson.M{"_id": courseID}).Decode(&course); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	enrollment := models.Enrollment{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		CourseID:  courseID,
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if _, err := db.Collection("enrollments").InsertOne(ctx, enrollment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not enroll"})
		return
	}
	c.JSON(http.StatusCreated, enrollment)
}

func ListMyEnrollments(c *gin.Context) {
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("enrollments").Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch enrollments"})
		return
	}
	defer cursor.Close(ctx)

	var enrollments []models.Enrollment
	if err := cursor.All(ctx, &enrollments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode enrollments"})
		return
	}

	if enrollments == nil {
		enrollments = []models.Enrollment{}
	}

	courseIDs := make([]primitive.ObjectID, len(enrollments))
	for i, e := range enrollments {
		courseIDs[i] = e.CourseID
	}

	if len(courseIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"enrollments": enrollments, "courses": []models.Course{}})
		return
	}

	courseCursor, err := db.Collection("courses").Find(ctx, bson.M{"_id": bson.M{"$in": courseIDs}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch courses"})
		return
	}
	defer courseCursor.Close(ctx)

	var courses []models.Course
	if err := courseCursor.All(ctx, &courses); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode courses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"enrollments": enrollments, "courses": courses})
}
