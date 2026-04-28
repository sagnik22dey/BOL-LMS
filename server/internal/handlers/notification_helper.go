package handlers

import (
	"context"
	"log"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/google/uuid"
)

// NotifyInput holds the data needed to create a single user_notification row.
type NotifyInput struct {
	RecipientID       uuid.UUID
	RecipientRole     string
	Title             string
	Message           string
	ShortSummary      string
	Type              string // "info" | "success" | "warning"
	Category          string // models.NotifCategory*
	RelatedEntityID   *uuid.UUID
	RelatedEntityType string
}

// CreateUserNotification inserts a single notification row for one recipient.
// It is fire-and-forget: errors are logged but never surface to the caller.
func CreateUserNotification(ctx context.Context, in NotifyInput) {
	id := uuid.New()
	now := time.Now()

	shortSummary := in.ShortSummary
	if shortSummary == "" {
		// Auto-truncate message as fallback summary
		shortSummary = in.Message
		if len(shortSummary) > 120 {
			shortSummary = shortSummary[:117] + "..."
		}
	}

	notifType := in.Type
	if notifType == "" {
		notifType = "info"
	}
	category := in.Category
	if category == "" {
		category = models.NotifCategoryGeneral
	}
	role := in.RecipientRole
	if role == "" {
		role = models.NotifRoleUser
	}

	_, err := db.Pool.Exec(ctx,
		`INSERT INTO user_notifications
		 (id, recipient_id, recipient_role, title, message, short_summary, type, category,
		  is_read, related_entity_id, related_entity_type, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10,$11)`,
		id,
		in.RecipientID,
		role,
		in.Title,
		in.Message,
		shortSummary,
		notifType,
		category,
		in.RelatedEntityID,
		in.RelatedEntityType,
		now,
	)
	if err != nil {
		log.Printf("[notify] failed to insert notification for %s: %v", in.RecipientID, err)
	}
}

// NotifySuperAdmins fans out a notification to every super_admin in the system.
func NotifySuperAdmins(ctx context.Context, in NotifyInput) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id FROM users WHERE role = 'super_admin'`)
	if err != nil {
		log.Printf("[notify] could not query super_admins: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var saID uuid.UUID
		if err := rows.Scan(&saID); err != nil {
			continue
		}
		cp := in
		cp.RecipientID = saID
		cp.RecipientRole = models.NotifRoleSuperAdmin
		CreateUserNotification(ctx, cp)
	}
}

// NotifyAdminsOfOrg fans out a notification to every admin in the given org.
func NotifyAdminsOfOrg(ctx context.Context, orgID uuid.UUID, in NotifyInput) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id FROM users WHERE role = 'admin' AND organization_id = $1`, orgID)
	if err != nil {
		log.Printf("[notify] could not query org admins for %s: %v", orgID, err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var aID uuid.UUID
		if err := rows.Scan(&aID); err != nil {
			continue
		}
		cp := in
		cp.RecipientID = aID
		cp.RecipientRole = models.NotifRoleAdmin
		CreateUserNotification(ctx, cp)
	}
}

// NotifyOrgMembers fans out a notification to every non-super_admin member of the given org.
func NotifyOrgMembers(ctx context.Context, orgID uuid.UUID, in NotifyInput) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, role FROM users WHERE organization_id = $1 AND role != 'super_admin'`, orgID)
	if err != nil {
		log.Printf("[notify] could not query org members for %s: %v", orgID, err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var uid uuid.UUID
		var role string
		if err := rows.Scan(&uid, &role); err != nil {
			continue
		}
		cp := in
		cp.RecipientID = uid
		cp.RecipientRole = role
		CreateUserNotification(ctx, cp)
	}
}

// NotifyAllUsers fans out a notification to every user in the system (except super_admins).
func NotifyAllUsers(ctx context.Context, in NotifyInput) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, role FROM users WHERE role != 'super_admin'`)
	if err != nil {
		log.Printf("[notify] could not query all users: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var uid uuid.UUID
		var role string
		if err := rows.Scan(&uid, &role); err != nil {
			continue
		}
		cp := in
		cp.RecipientID = uid
		cp.RecipientRole = role
		CreateUserNotification(ctx, cp)
	}
}
