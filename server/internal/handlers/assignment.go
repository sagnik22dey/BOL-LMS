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

func CreateAssignment(c *gin.Context) {
	orgID, _ := uuid.Parse(c.GetString("org_id"))
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module id"})
		return
	}

	var assignment models.Assignment
	if err := c.ShouldBindJSON(&assignment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignment.ID = uuid.New()
	assignment.CourseID = courseID
	assignment.ModuleID = moduleID
	assignment.OrganizationID = orgID
	assignment.CreatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO assignments (id, course_id, module_id, organization_id, title, description, deadline, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		assignment.ID, assignment.CourseID, assignment.ModuleID, assignment.OrganizationID,
		assignment.Title, assignment.Description, assignment.Deadline, assignment.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create assignment"})
		return
	}
	c.JSON(http.StatusCreated, assignment)
}

func SubmitAssignment(c *gin.Context) {
	assignmentID, err := uuid.Parse(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	userID, _ := uuid.Parse(c.GetString("user_id"))

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
	row := db.Pool.QueryRow(ctx,
		`SELECT id, course_id, module_id, organization_id, title, description, deadline, created_at
		 FROM assignments WHERE id = $1`, assignmentID)
	err = row.Scan(&assignment.ID, &assignment.CourseID, &assignment.ModuleID, &assignment.OrganizationID,
		&assignment.Title, &assignment.Description, &assignment.Deadline, &assignment.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return
	}

	var existing models.AssignmentSubmission
	existRow := db.Pool.QueryRow(ctx,
		`SELECT id, assignment_id, module_id, user_id, file_path, submitted_at, retake_allowed
		 FROM assignment_submissions WHERE assignment_id = $1 AND user_id = $2`, assignmentID, userID)
	existErr := existRow.Scan(&existing.ID, &existing.AssignmentID, &existing.ModuleID,
		&existing.UserID, &existing.FilePath, &existing.SubmittedAt, &existing.RetakeAllowed)

	if existErr == nil && !existing.RetakeAllowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "assignment already submitted"})
		return
	}

	submission := models.AssignmentSubmission{
		ID:           uuid.New(),
		AssignmentID: assignmentID,
		ModuleID:     assignment.ModuleID,
		UserID:       userID,
		FilePath:     payload.FilePath,
		SubmittedAt:  time.Now(),
	}

	if existErr == nil {
		submission.ID = existing.ID
		_, err = db.Pool.Exec(ctx,
			`UPDATE assignment_submissions SET file_path=$1, submitted_at=$2, retake_allowed=FALSE WHERE id=$3`,
			submission.FilePath, submission.SubmittedAt, submission.ID,
		)
	} else {
		_, err = db.Pool.Exec(ctx,
			`INSERT INTO assignment_submissions (id, assignment_id, module_id, user_id, file_path, submitted_at, retake_allowed)
			 VALUES ($1, $2, $3, $4, $5, $6, FALSE)
			 ON CONFLICT (assignment_id, user_id) DO UPDATE
			   SET file_path=$5, submitted_at=$6, retake_allowed=FALSE`,
			submission.ID, submission.AssignmentID, submission.ModuleID, submission.UserID,
			submission.FilePath, submission.SubmittedAt,
		)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save assignment submission"})
		return
	}
	c.JSON(http.StatusCreated, submission)
}

func ResetAssignment(c *gin.Context) {
	assignmentID, err := uuid.Parse(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`UPDATE assignment_submissions SET retake_allowed=TRUE
		 WHERE assignment_id=$1 AND user_id=$2`, assignmentID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reset assignment"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "assignment reset for retake"})
}

func GetModuleAssessments(c *gin.Context) {
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	quizzes := []models.Submission{}
	qRows, _ := db.Pool.Query(ctx,
		`SELECT id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, graded_by, started_at, submitted_at, retake_allowed
		 FROM submissions WHERE module_id = $1`, moduleID)
	if qRows != nil {
		defer qRows.Close()
		for qRows.Next() {
			s, err := scanSubmission(qRows)
			if err == nil {
				quizzes = append(quizzes, s)
			}
		}
	}

	assignments := []models.AssignmentSubmission{}
	aRows, _ := db.Pool.Query(ctx,
		`SELECT id, assignment_id, module_id, user_id, file_path, submitted_at, retake_allowed
		 FROM assignment_submissions WHERE module_id = $1`, moduleID)
	if aRows != nil {
		defer aRows.Close()
		for aRows.Next() {
			var as models.AssignmentSubmission
			if err := aRows.Scan(&as.ID, &as.AssignmentID, &as.ModuleID, &as.UserID,
				&as.FilePath, &as.SubmittedAt, &as.RetakeAllowed); err == nil {
				assignments = append(assignments, as)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"quizzes":     quizzes,
		"assignments": assignments,
	})
}

func GetAssignment(c *gin.Context) {
	assignmentID, err := uuid.Parse(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var assignment models.Assignment
	row := db.Pool.QueryRow(ctx,
		`SELECT id, course_id, module_id, organization_id, title, description, deadline, created_at
		 FROM assignments WHERE id = $1`, assignmentID)
	if err := row.Scan(&assignment.ID, &assignment.CourseID, &assignment.ModuleID, &assignment.OrganizationID,
		&assignment.Title, &assignment.Description, &assignment.Deadline, &assignment.CreatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return
	}
	c.JSON(http.StatusOK, assignment)
}

func GetMyAssignmentSubmission(c *gin.Context) {
	assignmentID, err := uuid.Parse(c.Param("assignmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}
	userID, _ := uuid.Parse(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.AssignmentSubmission
	row := db.Pool.QueryRow(ctx,
		`SELECT id, assignment_id, module_id, user_id, file_path, submitted_at, retake_allowed
		 FROM assignment_submissions WHERE assignment_id=$1 AND user_id=$2`, assignmentID, userID)
	if err := row.Scan(&existing.ID, &existing.AssignmentID, &existing.ModuleID,
		&existing.UserID, &existing.FilePath, &existing.SubmittedAt, &existing.RetakeAllowed); err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, existing)
}
