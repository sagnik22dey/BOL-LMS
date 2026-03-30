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

type AnalyticsOrganization struct {
	ID        uuid.UUID    `json:"id"`
	Name      string       `json:"name"`
	Slug      string       `json:"slug"`
	CreatedAt time.Time    `json:"created_at"`
	Admins    []models.User `json:"admins"`
	Users     []models.User `json:"users"`
}

type SuperAdminAnalyticsResponse struct {
	TotalOrganizations int64                   `json:"total_organizations"`
	TotalAdmins        int64                   `json:"total_admins"`
	TotalUsers         int64                   `json:"total_users"`
	Organizations      []AnalyticsOrganization `json:"organizations"`
}

func GetSuperAdminAnalytics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var response SuperAdminAnalyticsResponse

	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM organizations`).Scan(&response.TotalOrganizations)
	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='admin'`).Scan(&response.TotalAdmins)
	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='user'`).Scan(&response.TotalUsers)

	orgRows, err := db.Pool.Query(ctx, `SELECT id, name, slug, created_at FROM organizations`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch organizations"})
		return
	}
	defer orgRows.Close()

	type orgRow struct {
		id        uuid.UUID
		name      string
		slug      string
		createdAt time.Time
	}
	var orgs []orgRow
	for orgRows.Next() {
		var o orgRow
		if orgRows.Scan(&o.id, &o.name, &o.slug, &o.createdAt) == nil {
			orgs = append(orgs, o)
		}
	}

	userRows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE role IN ('admin', 'user')`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch users"})
		return
	}
	defer userRows.Close()

	adminMap := make(map[uuid.UUID][]models.User)
	userMap := make(map[uuid.UUID][]models.User)
	for userRows.Next() {
		u, err := scanUser(userRows)
		if err != nil || u.OrganizationID == nil {
			continue
		}
		if u.Role == models.RoleAdmin {
			adminMap[*u.OrganizationID] = append(adminMap[*u.OrganizationID], u)
		} else {
			userMap[*u.OrganizationID] = append(userMap[*u.OrganizationID], u)
		}
	}

	response.Organizations = []AnalyticsOrganization{}
	for _, o := range orgs {
		admins := adminMap[o.id]
		if admins == nil {
			admins = []models.User{}
		}
		users := userMap[o.id]
		if users == nil {
			users = []models.User{}
		}
		response.Organizations = append(response.Organizations, AnalyticsOrganization{
			ID:        o.id,
			Name:      o.name,
			Slug:      o.slug,
			CreatedAt: o.createdAt,
			Admins:    admins,
			Users:     users,
		})
	}

	c.JSON(http.StatusOK, response)
}
