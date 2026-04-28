package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// generateSecureKey returns a cryptographically random 32-byte hex string
// prefixed with "lms_" to make keys easy to identify.
func generateSecureKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "lms_" + hex.EncodeToString(b), nil
}

// GenerateCourseAPIKey creates a new API key scoped to a single course.
// Route: POST /api/admin/courses/:id/api-keys
// Access: admin of the owning organisation only.
func GenerateCourseAPIKey(c *gin.Context) {
	adminIDStr := c.GetString("user_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	var req models.GenerateAPIKeyRequest
	// label is optional, so we only bind JSON to read it; course_id comes from the URL.
	_ = c.ShouldBindJSON(&req)
	label := strings.TrimSpace(req.Label)
	if label == "" {
		label = "API Key"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Verify the course belongs to the admin's organisation.
	orgIDStr := c.GetString("org_id")
	orgID, parseErr := uuid.Parse(orgIDStr)
	if parseErr != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin not associated with an organisation"})
		return
	}

	var courseOrgID uuid.UUID
	if err := db.Pool.QueryRow(ctx,
		`SELECT organization_id FROM courses WHERE id=$1`, courseID,
	).Scan(&courseOrgID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	if courseOrgID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "course does not belong to your organisation"})
		return
	}

	// Generate the key and persist it.
	rawKey, err := generateSecureKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate key"})
		return
	}

	now := time.Now()
	apiKey := models.CourseAPIKey{
		ID:        uuid.New(),
		CourseID:  courseID,
		Key:       rawKey,
		Label:     label,
		IsActive:  true,
		CreatedBy: adminID,
		CreatedAt: now,
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO course_api_keys (id, course_id, key, label, is_active, created_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		apiKey.ID, apiKey.CourseID, apiKey.Key, apiKey.Label,
		apiKey.IsActive, apiKey.CreatedBy, apiKey.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save api key"})
		return
	}

	c.JSON(http.StatusCreated, apiKey)
}

// ListCourseAPIKeys returns all API keys for a course.
// Route: GET /api/admin/courses/:id/api-keys
// Access: admin of the owning organisation only.
func ListCourseAPIKeys(c *gin.Context) {
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Verify ownership.
	orgIDStr := c.GetString("org_id")
	orgID, parseErr := uuid.Parse(orgIDStr)
	if parseErr != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin not associated with an organisation"})
		return
	}

	var courseOrgID uuid.UUID
	if err := db.Pool.QueryRow(ctx,
		`SELECT organization_id FROM courses WHERE id=$1`, courseID,
	).Scan(&courseOrgID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	if courseOrgID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "course does not belong to your organisation"})
		return
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT k.id, k.course_id, c.title, k.key, k.label, k.is_active, k.created_by, k.revoked_at, k.created_at
		 FROM course_api_keys k
		 JOIN courses c ON c.id = k.course_id
		 WHERE k.course_id = $1
		 ORDER BY k.created_at DESC`, courseID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch api keys"})
		return
	}
	defer rows.Close()

	keys := []models.CourseAPIKey{}
	for rows.Next() {
		var k models.CourseAPIKey
		if err := rows.Scan(&k.ID, &k.CourseID, &k.CourseTitle, &k.Key, &k.Label,
			&k.IsActive, &k.CreatedBy, &k.RevokedAt, &k.CreatedAt); err == nil {
			keys = append(keys, k)
		}
	}

	c.JSON(http.StatusOK, keys)
}

// RevokeAPIKey marks an API key as inactive so it can no longer be used.
// Route: DELETE /api/admin/api-keys/:keyId
// Access: admin of the owning organisation only.
func RevokeAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("keyId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid key id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Verify the key belongs to a course in the admin's organisation.
	orgIDStr := c.GetString("org_id")
	orgID, parseErr := uuid.Parse(orgIDStr)
	if parseErr != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin not associated with an organisation"})
		return
	}

	var courseOrgID uuid.UUID
	if err := db.Pool.QueryRow(ctx,
		`SELECT c.organization_id
		 FROM course_api_keys k
		 JOIN courses c ON c.id = k.course_id
		 WHERE k.id = $1`, keyID,
	).Scan(&courseOrgID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "api key not found"})
		return
	}

	if courseOrgID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "api key does not belong to your organisation"})
		return
	}

	now := time.Now()
	_, err = db.Pool.Exec(ctx,
		`UPDATE course_api_keys SET is_active=FALSE, revoked_at=$1 WHERE id=$2`,
		now, keyID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not revoke api key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "api key revoked successfully", "revoked_at": now})
}

// ProvisionCourseAccess is the public endpoint called by third-party websites
// after a customer completes a purchase. The caller must include the
// course-specific API key in the "X-API-Key" header.
//
// Route: POST /api/external/provision
// Auth:  X-API-Key header (no JWT required).
//
// Behaviour:
//  1. Validate the API key and look up the associated course.
//  2. Look up the user by email; if not found, create a new account.
//  3. Upsert a user_course_assignment so the user can enroll.
//  4. Upsert an enrollment record so the course appears in "My Learning".
func ProvisionCourseAccess(c *gin.Context) {
	rawKey := strings.TrimSpace(c.GetHeader("X-API-Key"))
	if rawKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing X-API-Key header"})
		return
	}

	var req models.ProvisionAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// ── 1. Validate the API key ───────────────────────────────────────────────
	var keyID uuid.UUID
	var courseID uuid.UUID
	var isActive bool
	err := db.Pool.QueryRow(ctx,
		`SELECT id, course_id, is_active FROM course_api_keys WHERE key=$1`, rawKey,
	).Scan(&keyID, &courseID, &isActive)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
		return
	}
	if !isActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "api key has been revoked"})
		return
	}

	// ── 2. Resolve the user (create if absent) ────────────────────────────────
	var user models.User
	isNewUser := false

	err = db.Pool.QueryRow(ctx,
		`SELECT id, name, email, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE email=$1`, req.Email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role,
		&user.OrganizationID, &user.IsSuspended, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		// User doesn't exist – create one with a random password.
		isNewUser = true
		randomBytes := make([]byte, 16)
		if _, randErr := rand.Read(randomBytes); randErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate user credentials"})
			return
		}
		tempPassword := hex.EncodeToString(randomBytes)
		hash, hashErr := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
		if hashErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			// Derive a sensible default name from the email local part.
			parts := strings.SplitN(req.Email, "@", 2)
			name = parts[0]
		}

		now := time.Now()
		user = models.User{
			ID:           uuid.New(),
			Name:         name,
			Email:        req.Email,
			PasswordHash: string(hash),
			Role:         models.RoleUser,
			IsSuspended:  false,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		_, insertErr := db.Pool.Exec(ctx,
			`INSERT INTO users (id, name, email, password_hash, role, is_suspended, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			user.ID, user.Name, user.Email, user.PasswordHash,
			user.Role, user.IsSuspended, user.CreatedAt, user.UpdatedAt,
		)
		if insertErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user account"})
			return
		}
	}

	if user.IsSuspended {
		c.JSON(http.StatusForbidden, gin.H{"error": "user account is suspended"})
		return
	}

	// ── 3. Upsert user_course_assignment (grants purchase entitlement) ─────────
	// We use the key's own ID as the "assigned_by" sentinel so that audit
	// queries can distinguish API-key assignments from admin assignments.
	// Postgres doesn't allow a non-user UUID here, so we record the key's
	// creator instead.
	var keyCreator uuid.UUID
	_ = db.Pool.QueryRow(ctx,
		`SELECT created_by FROM course_api_keys WHERE id=$1`, keyID,
	).Scan(&keyCreator)

	now := time.Now()
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO user_course_assignments (id, user_id, course_id, assigned_by, assigned_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, course_id) DO NOTHING`,
		uuid.New(), user.ID, courseID, keyCreator, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign course"})
		return
	}

	// ── 4. Upsert enrollment so the course appears in My Learning immediately ──
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO enrollments (id, user_id, course_id, progress, created_at, updated_at)
		VALUES ($1, $2, $3, 0, $4, $5)
		ON CONFLICT (user_id, course_id) DO NOTHING`,
		uuid.New(), user.ID, courseID, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not enroll user"})
		return
	}

	c.JSON(http.StatusOK, models.ProvisionAccessResponse{
		UserID:     user.ID,
		CourseID:   courseID,
		Email:      user.Email,
		IsNewUser:  isNewUser,
		AssignedAt: now,
	})
}
