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
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func ListComments(c *gin.Context) {
	moduleId, err := primitive.ObjectIDFromHex(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid moduleId"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOptions := options.Find()
	findOptions.SetSort(bson.D{{Key: "created_at", Value: 1}}) // Oldest first

	cursor, err := db.Collection("comments").Find(ctx, bson.M{"module_id": moduleId}, findOptions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch comments"})
		return
	}
	defer cursor.Close(ctx)

	var comments []models.Comment
	if err := cursor.All(ctx, &comments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode comments"})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func CreateComment(c *gin.Context) {
	moduleId, err := primitive.ObjectIDFromHex(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid moduleId"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.GetString("user_id"))
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
		ID:        primitive.NewObjectID(),
		ModuleID:  moduleId,
		UserID:    userID,
		UserName:  userName,
		Text:      req.Text,
		CreatedAt: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("comments").InsertOne(ctx, comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save comment"})
		return
	}

	// Broadcast via WebSocket
	commentJSON, _ := json.Marshal(comment)
	ws.GlobalHub.Broadcast(ws.Message{
		ModuleID: moduleId.Hex(),
		Type:     "new_comment",
		Data:     commentJSON,
	})

	c.JSON(http.StatusCreated, comment)
}
