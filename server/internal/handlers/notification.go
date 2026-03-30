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

func CreateNotification(c *gin.Context) {
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	role := c.GetString("role")
	var orgIDPtr *uuid.UUID

	if role != string(models.RoleSuperAdmin) {
		orgIDStr := c.GetString("org_id")
		if orgIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin not associated with an organization"})
			return
		}
		orgID, _ := uuid.Parse(orgIDStr)
		orgIDPtr = &orgID
	}

	notification := models.Notification{
		ID:             uuid.New(),
		Title:          req.Title,
		Message:        req.Message,
		Type:           req.Type,
		OrganizationID: orgIDPtr,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO notifications (id, title, message, type, organization_id, created_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		notification.ID, notification.Title, notification.Message, notification.Type,
		notification.OrganizationID, notification.CreatedBy, notification.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create notification"})
		return
	}

	c.JSON(http.StatusCreated, notification)
}

func GetLatestNotifications(c *gin.Context) {
	role := c.GetString("role")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var rows interface {
		Close()
		Next() bool
		Scan(...any) error
	}
	var err error

	if role == string(models.RoleSuperAdmin) {
		rows, err = db.Pool.Query(ctx,
			`SELECT id, title, message, type, organization_id, created_by, created_at
			 FROM notifications ORDER BY created_at DESC LIMIT 20`)
	} else {
		orgIDStr := c.GetString("org_id")
		if orgIDStr != "" {
			orgID, _ := uuid.Parse(orgIDStr)
			rows, err = db.Pool.Query(ctx,
				`SELECT id, title, message, type, organization_id, created_by, created_at
				 FROM notifications
				 WHERE organization_id IS NULL OR organization_id=$1
				 ORDER BY created_at DESC LIMIT 20`, orgID)
		} else {
			rows, err = db.Pool.Query(ctx,
				`SELECT id, title, message, type, organization_id, created_by, created_at
				 FROM notifications WHERE organization_id IS NULL
				 ORDER BY created_at DESC LIMIT 20`)
		}
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch notifications"})
		return
	}
	defer rows.Close()

	notifications := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.Title, &n.Message, &n.Type, &n.OrganizationID, &n.CreatedBy, &n.CreatedAt); err == nil {
			notifications = append(notifications, n)
		}
	}
	c.JSON(http.StatusOK, notifications)
}
