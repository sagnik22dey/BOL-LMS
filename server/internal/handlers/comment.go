package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"
	"bol-lms-server/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// maxCommentLength is the maximum allowed number of characters in a comment.
// QUAL-004: Prevents storage abuse and oversized WebSocket broadcasts.
const maxCommentLength = 5000

func ListComments(c *gin.Context) {
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid moduleId"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, module_id, user_id, user_name, text, created_at
		 FROM comments WHERE module_id=$1 ORDER BY created_at ASC`, moduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch comments"})
		return
	}
	defer rows.Close()

	comments := []models.Comment{}
	for rows.Next() {
		var comment models.Comment
		if err := rows.Scan(&comment.ID, &comment.ModuleID, &comment.UserID,
			&comment.UserName, &comment.Text, &comment.CreatedAt); err == nil {
			comments = append(comments, comment)
		}
	}
	c.JSON(http.StatusOK, comments)
}

func CreateComment(c *gin.Context) {
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid moduleId"})
		return
	}

	// QUAL-003: Handle uuid.Parse error explicitly.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userName := c.GetString("name")

	var req struct {
		Text string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// QUAL-004: Enforce maximum comment length to prevent storage abuse.
	if len(req.Text) > maxCommentLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment exceeds maximum allowed length of 5000 characters"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// BL-007: Verify the user is enrolled in a course that contains this module,
	// or has a course assignment covering this module, before allowing them to comment.
	var enrollmentCheck string
	enrollErr := db.Pool.QueryRow(ctx, `
		SELECT e.id FROM enrollments e
		JOIN courses c ON e.course_id = c.id
		JOIN (
			SELECT (m->>'id')::uuid AS module_uuid, id AS course_id
			FROM courses,
			     jsonb_array_elements(modules) AS m
		) AS cm ON cm.course_id = c.id AND cm.module_uuid = $2
		WHERE e.user_id = $1
		LIMIT 1`, userID, moduleID).Scan(&enrollmentCheck)

	var assignmentCheck string
	assignErr := db.Pool.QueryRow(ctx, `
		SELECT uca.id FROM user_course_assignments uca
		JOIN (
			SELECT (m->>'id')::uuid AS module_uuid, id AS course_id
			FROM courses,
			     jsonb_array_elements(modules) AS m
		) AS cm ON cm.course_id = uca.course_id AND cm.module_uuid = $2
		WHERE uca.user_id = $1
		LIMIT 1`, userID, moduleID).Scan(&assignmentCheck)

	// Also allow admins (checked by role) to comment without enrollment
	role := c.GetString("role")
	isAdmin := role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin)

	if enrollErr != nil && assignErr != nil && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "you must be enrolled in the course to post comments"})
		return
	}

	comment := models.Comment{
		ID:        uuid.New(),
		ModuleID:  moduleID,
		UserID:    userID,
		UserName:  userName,
		Text:      req.Text,
		CreatedAt: time.Now(),
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO comments (id, module_id, user_id, user_name, text, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		comment.ID, comment.ModuleID, comment.UserID, comment.UserName, comment.Text, comment.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save comment"})
		return
	}

	commentJSON, _ := json.Marshal(comment)
	ws.GlobalHub.Broadcast(ws.Message{
		ModuleID: moduleID.String(),
		Type:     "new_comment",
		Data:     commentJSON,
	})

	c.JSON(http.StatusCreated, comment)
}
