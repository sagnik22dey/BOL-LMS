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
	"go.mongodb.org/mongo-driver/mongo/options"
)

func CreateNotification(c *gin.Context) {
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr := c.GetString("user_id")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	role := c.GetString("role")
	var orgIDPtr *primitive.ObjectID

	if role != string(models.RoleSuperAdmin) {
		orgIDStr := c.GetString("org_id")
		if orgIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin not associated with an organization"})
			return
		}
		orgID, _ := primitive.ObjectIDFromHex(orgIDStr)
		orgIDPtr = &orgID
	}
	// Super admins leave orgIDPtr = nil to broadcast system-wide

	notification := models.Notification{
		ID:             primitive.NewObjectID(),
		Title:          req.Title,
		Message:        req.Message,
		Type:           req.Type,
		OrganizationID: orgIDPtr,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("notifications").InsertOne(ctx, notification); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create notification"})
		return
	}

	c.JSON(http.StatusCreated, notification)
}

func GetLatestNotifications(c *gin.Context) {
	role := c.GetString("role")
	
	filter := bson.M{}

	if role != string(models.RoleSuperAdmin) {
		orgIDStr := c.GetString("org_id")
		if orgIDStr != "" {
			orgID, _ := primitive.ObjectIDFromHex(orgIDStr)
			// Users/Admins see system-wide announcements (orgId nil or non-existent) AND their own org's announcements
			filter = bson.M{
				"$or": []bson.M{
					{"organization_id": orgID},
					{"organization_id": nil},
					{"organization_id": bson.M{"$exists": false}},
				},
			}
		} else {
			// User without an org yet, they only see system-wide
			filter = bson.M{
				"$or": []bson.M{
					{"organization_id": nil},
					{"organization_id": bson.M{"$exists": false}},
				},
			}
		}
	} // Super admins see all notifications right now, or we could change this to just see system-wide. Let's show all for Super Admin.

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOptions := options.Find()
	findOptions.SetSort(bson.D{{Key: "created_at", Value: -1}}) // Sort by newest first
	findOptions.SetLimit(20) // Limit to latest 20 notifications

	cursor, err := db.Collection("notifications").Find(ctx, filter, findOptions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch notifications"})
		return
	}
	defer cursor.Close(ctx)

	var notifications []models.Notification
	if err := cursor.All(ctx, &notifications); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode notifications"})
		return
	}

	if notifications == nil {
		notifications = []models.Notification{}
	}

	c.JSON(http.StatusOK, notifications)
}
