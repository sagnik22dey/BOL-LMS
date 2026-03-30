package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func EnrollUser(c *gin.Context) {
	userID, _ := uuid.Parse(c.GetString("user_id"))

	var req models.EnrollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingID string
	if err := db.Pool.QueryRow(ctx,
		`SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2`, userID, courseID).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "already enrolled"})
		return
	}

	var courseCheckID string
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM courses WHERE id=$1`, courseID).Scan(&courseCheckID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	now := time.Now()
	enrollment := models.Enrollment{
		ID:        uuid.New(),
		UserID:    userID,
		CourseID:  courseID,
		Progress:  0,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO enrollments (id, user_id, course_id, progress, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		enrollment.ID, enrollment.UserID, enrollment.CourseID, enrollment.Progress, enrollment.CreatedAt, enrollment.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not enroll"})
		return
	}
	c.JSON(http.StatusCreated, enrollment)
}

func ListMyEnrollments(c *gin.Context) {
	userID, _ := uuid.Parse(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	eRows, err := db.Pool.Query(ctx,
		`SELECT id, user_id, course_id, progress, created_at, updated_at
		 FROM enrollments WHERE user_id=$1`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch enrollments"})
		return
	}
	defer eRows.Close()

	enrollments := []models.Enrollment{}
	var courseIDs []uuid.UUID
	for eRows.Next() {
		var e models.Enrollment
		if err := eRows.Scan(&e.ID, &e.UserID, &e.CourseID, &e.Progress, &e.CreatedAt, &e.UpdatedAt); err == nil {
			enrollments = append(enrollments, e)
			courseIDs = append(courseIDs, e.CourseID)
		}
	}

	if len(courseIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"enrollments": enrollments, "courses": []models.Course{}})
		return
	}

	cRows, err := db.Pool.Query(ctx,
		`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, created_at, updated_at
		 FROM courses WHERE id = ANY($1)`, courseIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch courses"})
		return
	}
	defer cRows.Close()

	courses := []models.Course{}
	for cRows.Next() {
		course, err := scanCourse(cRows)
		if err == nil {
			courses = append(courses, course)
		}
	}

	c.JSON(http.StatusOK, gin.H{"enrollments": enrollments, "courses": courses})
}
