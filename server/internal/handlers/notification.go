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

// ─── Legacy broadcast notifications (admin-created announcements) ────────────

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

	// Fan out to user_notifications so recipients see it in their per-user feed.
	fanInput := NotifyInput{
		Title:    notification.Title,
		Message:  notification.Message,
		Type:     notification.Type,
		Category: models.NotifCategoryGeneral,
	}
	go func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer bgCancel()
		if orgIDPtr != nil {
			// Org-scoped broadcast → notify every member of that org
			NotifyOrgMembers(bgCtx, *orgIDPtr, fanInput)
		} else {
			// Global broadcast (super_admin) → notify all non-super_admin users
			NotifyAllUsers(bgCtx, fanInput)
		}
	}()

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

// ─── Per-user event notifications ────────────────────────────────────────────

// GetMyNotifications returns all user_notifications for the authenticated user,
// ordered newest-first with a limit of 50.
func GetMyNotifications(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, recipient_id, recipient_role, title, message, short_summary, type, category,
		        is_read, related_entity_id, related_entity_type, created_at
		 FROM user_notifications
		 WHERE recipient_id = $1
		 ORDER BY created_at DESC
		 LIMIT 50`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch notifications"})
		return
	}
	defer rows.Close()

	notifications := []models.UserNotification{}
	for rows.Next() {
		var n models.UserNotification
		if err := rows.Scan(
			&n.ID, &n.RecipientID, &n.RecipientRole, &n.Title, &n.Message, &n.ShortSummary,
			&n.Type, &n.Category, &n.IsRead, &n.RelatedEntityID, &n.RelatedEntityType, &n.CreatedAt,
		); err == nil {
			notifications = append(notifications, n)
		}
	}
	c.JSON(http.StatusOK, notifications)
}

// GetUnreadCount returns the count of unread user_notifications for the caller.
func GetUnreadCount(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var count int
	if err := db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM user_notifications WHERE recipient_id=$1 AND is_read=false`,
		userID,
	).Scan(&count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch count"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"unread_count": count})
}

// GetNotificationByID returns a single user_notification by ID (must belong to caller).
func GetNotificationByID(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var n models.UserNotification
	err = db.Pool.QueryRow(ctx,
		`SELECT id, recipient_id, recipient_role, title, message, short_summary, type, category,
		        is_read, related_entity_id, related_entity_type, created_at
		 FROM user_notifications
		 WHERE id=$1 AND recipient_id=$2`,
		notifID, userID,
	).Scan(
		&n.ID, &n.RecipientID, &n.RecipientRole, &n.Title, &n.Message, &n.ShortSummary,
		&n.Type, &n.Category, &n.IsRead, &n.RelatedEntityID, &n.RelatedEntityType, &n.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}
	c.JSON(http.StatusOK, n)
}

// MarkNotificationRead marks a single notification as read (must belong to caller).
func MarkNotificationRead(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tag, err := db.Pool.Exec(ctx,
		`UPDATE user_notifications SET is_read=true WHERE id=$1 AND recipient_id=$2`,
		notifID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update notification"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

// MarkAllNotificationsRead marks all of the caller's notifications as read.
func MarkAllNotificationsRead(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`UPDATE user_notifications SET is_read=true WHERE recipient_id=$1 AND is_read=false`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update notifications"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "all marked as read"})
}
