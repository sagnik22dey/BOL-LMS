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

func CreateOrganization(c *gin.Context) {
	var req models.CreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingID string
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM organizations WHERE slug=$1`, req.Slug).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "slug already taken"})
		return
	}

	now := time.Now()
	org := models.Organization{
		ID:        uuid.New(),
		Name:      req.Name,
		Slug:      req.Slug,
		AdminIDs:  []uuid.UUID{},
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err := db.Pool.Exec(ctx,
		`INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		org.ID, org.Name, org.Slug, org.CreatedAt, org.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create organization"})
		return
	}
	c.JSON(http.StatusCreated, org)
}

func ListOrganizations(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, slug, created_at, updated_at FROM organizations`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list organizations"})
		return
	}
	defer rows.Close()

	orgs := []models.Organization{}
	for rows.Next() {
		var o models.Organization
		if err := rows.Scan(&o.ID, &o.Name, &o.Slug, &o.CreatedAt, &o.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode organizations"})
			return
		}
		o.AdminIDs = loadOrgAdminIDs(ctx, o.ID)
		orgs = append(orgs, o)
	}
	c.JSON(http.StatusOK, orgs)
}

func loadOrgAdminIDs(ctx context.Context, orgID uuid.UUID) []uuid.UUID {
	rows, _ := db.Pool.Query(ctx, `SELECT user_id FROM organization_admins WHERE organization_id=$1`, orgID)
	ids := []uuid.UUID{}
	if rows == nil {
		return ids
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func UpdateOrganization(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	var req models.UpdateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingID string
	if err := db.Pool.QueryRow(ctx,
		`SELECT id FROM organizations WHERE slug=$1 AND id!=$2`, req.Slug, orgID).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "slug already taken by another organization"})
		return
	}

	result, err := db.Pool.Exec(ctx,
		`UPDATE organizations SET name=$1, slug=$2, updated_at=$3 WHERE id=$4`,
		req.Name, req.Slug, time.Now(), orgID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update organization"})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "organization updated successfully"})
}

func AssignUserToOrg(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	var req models.AssignUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	if req.Role != models.RoleAdmin && req.Role != models.RoleUser {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if req.Role == models.RoleAdmin {
		_, err = db.Pool.Exec(ctx,
			`INSERT INTO organization_admins (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			orgID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign admin to organization"})
			return
		}
	} else {
		_, err = db.Pool.Exec(ctx,
			`DELETE FROM organization_admins WHERE organization_id=$1 AND user_id=$2`, orgID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update organization admins list"})
			return
		}
	}

	_, err = db.Pool.Exec(ctx,
		`UPDATE users SET role=$1, organization_id=$2, updated_at=$3 WHERE id=$4`,
		req.Role, orgID, time.Now(), userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update user role and org"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user assigned successfully"})
}

func GetMyOrganization(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	if orgIDStr == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "user has no organization"})
		return
	}

	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	row := db.Pool.QueryRow(ctx,
		`SELECT id, name, slug, created_at, updated_at FROM organizations WHERE id=$1`, orgID)
	if err := row.Scan(&org.ID, &org.Name, &org.Slug, &org.CreatedAt, &org.UpdatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}
	org.AdminIDs = loadOrgAdminIDs(ctx, org.ID)
	c.JSON(http.StatusOK, org)
}
