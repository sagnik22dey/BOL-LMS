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

	comment := models.Comment{
		ID:        uuid.New(),
		ModuleID:  moduleID,
		UserID:    userID,
		UserName:  userName,
		Text:      req.Text,
		CreatedAt: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

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
