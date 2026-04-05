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
	// QUAL-003: Handle parse error explicitly rather than silently using uuid.Nil.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

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

	// BL-004: Fetch course details and enforce access rules before enrolling.
	// Users must not be able to enroll in unpublished or foreign-org private courses.
	var isPublished bool
	var isPublic bool
	var courseOrgID uuid.UUID
	var coursePrice int
	err = db.Pool.QueryRow(ctx,
		`SELECT is_published, is_public, organization_id, price FROM courses WHERE id=$1`,
		courseID).Scan(&isPublished, &isPublic, &courseOrgID, &coursePrice)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	if !isPublished {
		c.JSON(http.StatusForbidden, gin.H{"error": "course is not available for enrollment"})
		return
	}

	// If the course is not public, the user must belong to the same org as the course.
	if !isPublic {
		callerOrgIDStr := c.GetString("org_id")
		callerOrgID, parseErr := uuid.Parse(callerOrgIDStr)
		if parseErr != nil || callerOrgID != courseOrgID {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied: you are not in the course's organization"})
			return
		}
	}

	// If the course has a price, the user must have a paid assignment or bundle assignment.
	if coursePrice > 0 {
		var paidAssignmentID string
		errAssign := db.Pool.QueryRow(ctx,
			`SELECT id FROM user_course_assignments WHERE user_id=$1 AND course_id=$2`,
			userID, courseID).Scan(&paidAssignmentID)

		var bundleAssignmentID string
		errBundle := db.Pool.QueryRow(ctx, `
			SELECT cbu.bundle_id FROM course_bundle_users cbu
			JOIN course_bundle_courses cbc ON cbu.bundle_id = cbc.bundle_id
			WHERE cbu.user_id=$1 AND cbc.course_id=$2 LIMIT 1`,
			userID, courseID).Scan(&bundleAssignmentID)

		if errAssign != nil && errBundle != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "purchase required to enroll in this course"})
			return
		}
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
	courseIDMap := make(map[uuid.UUID]bool)

	for eRows.Next() {
		var e models.Enrollment
		if err := eRows.Scan(&e.ID, &e.UserID, &e.CourseID, &e.Progress, &e.CreatedAt, &e.UpdatedAt); err == nil {
			enrollments = append(enrollments, e)
			if !courseIDMap[e.CourseID] {
				courseIDs = append(courseIDs, e.CourseID)
				courseIDMap[e.CourseID] = true
			}
		}
	}

	aRows, err := db.Pool.Query(ctx,
		`SELECT course_id FROM user_course_assignments WHERE user_id=$1`, userID)
	if err == nil {
		defer aRows.Close()
		for aRows.Next() {
			var cID uuid.UUID
			if err := aRows.Scan(&cID); err == nil {
				if !courseIDMap[cID] {
					courseIDs = append(courseIDs, cID)
					courseIDMap[cID] = true

					// Create dummy enrollment so it has progress=0
					enrollments = append(enrollments, models.Enrollment{
						ID:        uuid.Nil,
						UserID:    userID,
						CourseID:  cID,
						Progress:  0,
						CreatedAt: time.Now(),
						UpdatedAt: time.Now(),
					})
				}
			}
		}
	}

	if len(courseIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"enrollments": enrollments, "courses": []models.Course{}})
		return
	}

	cRows, err := db.Pool.Query(ctx,
		`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, is_public, price, currency, validity_days, instructor_name, instructor_bio, created_at, updated_at
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
