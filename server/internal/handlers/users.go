package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type CreateAdminRequest struct {
	Name           string `json:"name" binding:"required"`
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required,min=6"`
	OrganizationID string `json:"organization_id" binding:"required"`
}

func CreateAdmin(c *gin.Context) {
	var req CreateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingID string
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, req.Email).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	now := time.Now()
	user := models.User{
		ID:             uuid.New(),
		Name:           req.Name,
		Email:          req.Email,
		PasswordHash:   string(hash),
		Role:           models.RoleAdmin,
		OrganizationID: &orgID,
		IsSuspended:    false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO users (id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		user.ID, user.Name, user.Email, user.PasswordHash, user.Role, user.OrganizationID, user.IsSuspended, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create admin"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

type CreateUserRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func CreateOrganizationUser(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	if orgIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "admin not associated with an organization"})
		return
	}

	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid admin organization"})
		return
	}

	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingID string
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, req.Email).Scan(&existingID); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	now := time.Now()
	user := models.User{
		ID:             uuid.New(),
		Name:           req.Name,
		Email:          req.Email,
		PasswordHash:   string(hash),
		Role:           models.RoleUser,
		OrganizationID: &orgID,
		IsSuspended:    false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO users (id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		user.ID, user.Name, user.Email, user.PasswordHash, user.Role, user.OrganizationID, user.IsSuspended, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func scanUser(rows interface{ Scan(...any) error }) (models.User, error) {
	var u models.User
	err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role,
		&u.OrganizationID, &u.IsSuspended, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func GetOrganizationUsers(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	if orgIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "admin not associated with an organization"})
		return
	}

	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid admin organization"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE organization_id = $1 AND role = 'user'`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch organization users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func GetSuperAdminsUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE role IN ('admin', 'user')`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func GetUnassignedUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE role != 'super_admin' AND organization_id IS NULL`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch unassigned users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

// GetEligibleUsers returns users eligible to be assigned to an org.
// Query params:
//   - role: "admin" (returns users with no organization_id) or "user" (returns all non-super_admin, non-admin users)
//   - search: optional string to filter by name or email (case-insensitive)
func GetEligibleUsers(c *gin.Context) {
	role := c.DefaultQuery("role", "user")
	search := c.DefaultQuery("search", "")
	searchPattern := "%" + search + "%"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var rows interface {
		Next() bool
		Close()
		Scan(...any) error
	}
	var err error

	if role == "admin" {
		// Admins must have no organization yet
		rows, err = db.Pool.Query(ctx,
			`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
			 FROM users
			 WHERE role != 'super_admin'
			   AND organization_id IS NULL
			   AND (name ILIKE $1 OR email ILIKE $1)
			 ORDER BY name ASC`,
			searchPattern,
		)
	} else {
		// Regular users: all non-super-admins and non-admins (can be in multiple orgs)
		rows, err = db.Pool.Query(ctx,
			`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
			 FROM users
			 WHERE role != 'super_admin' AND role != 'admin'
			   AND (name ILIKE $1 OR email ILIKE $1)
			 ORDER BY name ASC`,
			searchPattern,
		)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch eligible users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

// GetAdminEligibleUsers returns users eligible to be added to the calling admin's organization.
// Only returns role='user' users who are NOT already in the admin's organization.
// Query params:
//   - search: optional string to filter by name or email (case-insensitive)
func GetAdminEligibleUsers(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	if orgIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not associated with an organization"})
		return
	}
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}
	search := c.DefaultQuery("search", "")
	searchPattern := "%" + search + "%"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users
		 WHERE role = 'user'
		   AND id NOT IN (
		       SELECT user_id FROM user_organizations WHERE organization_id = $1
		   )
		   AND (name ILIKE $2 OR email ILIKE $2)
		 ORDER BY name ASC`,
		orgID, searchPattern,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch eligible users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id: " + c.Param("id")})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var userToDel models.User
	row := db.Pool.QueryRow(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE id = $1`, id)
	if err := row.Scan(&userToDel.ID, &userToDel.Name, &userToDel.Email, &userToDel.PasswordHash,
		&userToDel.Role, &userToDel.OrganizationID, &userToDel.IsSuspended, &userToDel.CreatedAt, &userToDel.UpdatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	callerRole := c.GetString("role")
	callerOrgID := c.GetString("org_id")

	if callerRole != string(models.RoleSuperAdmin) {
		if userToDel.OrganizationID == nil || userToDel.OrganizationID.String() != callerOrgID {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only delete users in your own organization"})
			return
		}
	}

	if _, err = db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error during deletion"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

func SuspendUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id: " + c.Param("id")})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var userToToggle models.User
	row := db.Pool.QueryRow(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE id = $1`, id)
	if err := row.Scan(&userToToggle.ID, &userToToggle.Name, &userToToggle.Email, &userToToggle.PasswordHash,
		&userToToggle.Role, &userToToggle.OrganizationID, &userToToggle.IsSuspended, &userToToggle.CreatedAt, &userToToggle.UpdatedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	callerRole := c.GetString("role")
	callerOrgID := c.GetString("org_id")

	if callerRole != string(models.RoleSuperAdmin) {
		if userToToggle.OrganizationID == nil || userToToggle.OrganizationID.String() != callerOrgID {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only manage users in your own organization"})
			return
		}
	}

	_, err = db.Pool.Exec(ctx,
		`UPDATE users SET is_suspended = $1, updated_at = $2 WHERE id = $3`,
		!userToToggle.IsSuspended, time.Now(), id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error during update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user status updated"})
}
