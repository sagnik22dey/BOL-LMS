package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QuizSubmissionDetail is the enriched response type for admin assessment view.
type QuizSubmissionDetail struct {
	ID            uuid.UUID                 `json:"id"`
	QuizID        uuid.UUID                 `json:"quiz_id"`
	QuizTitle     string                    `json:"quiz_title"`
	QuizQuestions []models.Question         `json:"quiz_questions"`
	ModuleID      uuid.UUID                 `json:"module_id"`
	UserID        uuid.UUID                 `json:"user_id"`
	UserName      string                    `json:"user_name"`
	UserEmail     string                    `json:"user_email"`
	Answers       []models.SubmissionAnswer `json:"answers"`
	Score         int                       `json:"score"`
	MaxScore      int                       `json:"max_score"`
	IsGraded      bool                      `json:"is_graded"`
	GradedBy      *uuid.UUID                `json:"graded_by,omitempty"`
	StartedAt     time.Time                 `json:"started_at"`
	SubmittedAt   *time.Time                `json:"submitted_at,omitempty"`
	RetakeAllowed bool                      `json:"retake_allowed"`
}

// AssignmentSubmissionDetail is the enriched response type for admin assessment view.
type AssignmentSubmissionDetail struct {
	ID              uuid.UUID `json:"id"`
	AssignmentID    uuid.UUID `json:"assignment_id"`
	AssignmentTitle string    `json:"assignment_title"`
	ModuleID        uuid.UUID `json:"module_id"`
	UserID          uuid.UUID `json:"user_id"`
	UserName        string    `json:"user_name"`
	UserEmail       string    `json:"user_email"`
	FilePath        string    `json:"file_path"`
	SubmittedAt     time.Time `json:"submitted_at"`
	RetakeAllowed   bool      `json:"retake_allowed"`
}

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
	// QUAL-003: Handle parse error explicitly.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

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

	// BL-006: Verify the course belongs to the calling admin's org before returning
	// any user submission data. Use the course record directly so that modules
	// without any assessments yet are not rejected.
	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var courseOrgID uuid.UUID
	if err := db.Pool.QueryRow(ctx,
		`SELECT organization_id FROM courses WHERE id=$1`, courseID).Scan(&courseOrgID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}
	if courseOrgID != callerOrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: course belongs to a different organization"})
		return
	}

	// Fetch quiz submissions enriched with user name/email and quiz title+questions
	quizzes := []QuizSubmissionDetail{}
	qRows, qErr := db.Pool.Query(ctx,
		`SELECT s.id, s.quiz_id, q.title, q.questions, s.module_id, s.user_id,
		        u.name, u.email,
		        s.answers, s.score, s.max_score, s.is_graded, s.graded_by,
		        s.started_at, s.submitted_at, s.retake_allowed
		 FROM submissions s
		 JOIN quizzes q ON q.id = s.quiz_id
		 JOIN users u ON u.id = s.user_id
		 WHERE s.module_id = $1`, moduleID)
	if qErr == nil && qRows != nil {
		defer qRows.Close()
		for qRows.Next() {
			var d QuizSubmissionDetail
			var rawAnswers []byte
			var rawQuestions []byte
			if err := qRows.Scan(
				&d.ID, &d.QuizID, &d.QuizTitle, &rawQuestions, &d.ModuleID, &d.UserID,
				&d.UserName, &d.UserEmail,
				&rawAnswers, &d.Score, &d.MaxScore, &d.IsGraded, &d.GradedBy,
				&d.StartedAt, &d.SubmittedAt, &d.RetakeAllowed,
			); err == nil {
				if len(rawAnswers) > 0 {
					_ = json.Unmarshal(rawAnswers, &d.Answers)
				}
				if d.Answers == nil {
					d.Answers = []models.SubmissionAnswer{}
				}
				if len(rawQuestions) > 0 {
					_ = json.Unmarshal(rawQuestions, &d.QuizQuestions)
				}
				if d.QuizQuestions == nil {
					d.QuizQuestions = []models.Question{}
				}
				quizzes = append(quizzes, d)
			}
		}
	}

	// Fetch assignment submissions enriched with user name/email and assignment title
	assignments := []AssignmentSubmissionDetail{}
	aRows, aErr := db.Pool.Query(ctx,
		`SELECT asub.id, asub.assignment_id, a.title, asub.module_id, asub.user_id,
		        u.name, u.email,
		        asub.file_path, asub.submitted_at, asub.retake_allowed
		 FROM assignment_submissions asub
		 JOIN assignments a ON a.id = asub.assignment_id
		 JOIN users u ON u.id = asub.user_id
		 WHERE asub.module_id = $1`, moduleID)
	if aErr == nil && aRows != nil {
		defer aRows.Close()
		for aRows.Next() {
			var d AssignmentSubmissionDetail
			if err := aRows.Scan(
				&d.ID, &d.AssignmentID, &d.AssignmentTitle, &d.ModuleID, &d.UserID,
				&d.UserName, &d.UserEmail,
				&d.FilePath, &d.SubmittedAt, &d.RetakeAllowed,
			); err == nil {
				assignments = append(assignments, d)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"quizzes":     quizzes,
		"assignments": assignments,
	})
}

// GradeSubmission allows an admin to manually set a score on a quiz submission
// (used for written-answer questions where auto-grading is not possible).
func GradeSubmission(c *gin.Context) {
	submissionID, err := uuid.Parse(c.Param("submissionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}

	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}
	graderID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	var payload struct {
		Score int `json:"score" binding:"required,min=0"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Verify the quiz for this submission belongs to the caller's org
	var quizOrgID uuid.UUID
	if err := db.Pool.QueryRow(ctx,
		`SELECT q.organization_id FROM submissions s JOIN quizzes q ON q.id = s.quiz_id WHERE s.id=$1`,
		submissionID).Scan(&quizOrgID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	if quizOrgID != callerOrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	_, err = db.Pool.Exec(ctx,
		`UPDATE submissions SET score=$1, is_graded=TRUE, graded_by=$2 WHERE id=$3`,
		payload.Score, graderID, submissionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save grade"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "graded", "score": payload.Score})
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
	// QUAL-003: Handle parse error explicitly.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

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
