package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"bol-lms-server/config"
	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"
	"bol-lms-server/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func scanCourse(row interface{ Scan(...any) error }) (models.Course, error) {
	var c models.Course
	var rawModules []byte
	err := row.Scan(&c.ID, &c.OrganizationID, &c.Title, &c.Description,
		&c.ThumbnailKey, &rawModules, &c.IsPublished, &c.IsPublic,
		&c.Price, &c.Currency, &c.ValidityDays,
		&c.InstructorName, &c.InstructorBio,
		&c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return c, err
	}
	if len(rawModules) > 0 {
		_ = json.Unmarshal(rawModules, &c.Modules)
	}
	if c.Modules == nil {
		c.Modules = []models.Module{}
	}
	return c, nil
}

func CreateCourse(c *gin.Context) {
	orgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	var req models.CreateCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	now := time.Now()
	course := models.Course{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Title:          req.Title,
		Description:    req.Description,
		Price:          req.Price,
		Currency:       currency,
		ValidityDays:   req.ValidityDays,
		InstructorName: req.InstructorName,
		InstructorBio:  req.InstructorBio,
		Modules:        []models.Module{},
		IsPublished:    false,
		IsPublic:       false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	modulesJSON, _ := json.Marshal(course.Modules)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO courses (id, organization_id, title, description, thumbnail_key, modules, is_published, is_public, price, currency, validity_days, instructor_name, instructor_bio, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		course.ID, course.OrganizationID, course.Title, course.Description, course.ThumbnailKey,
		modulesJSON, course.IsPublished, course.IsPublic, course.Price, course.Currency, course.ValidityDays,
		course.InstructorName, course.InstructorBio, course.CreatedAt, course.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create course"})
		return
	}

	// Initialise the hierarchical storage directories for this course.
	// Look up the org slug for building the prefix.
	var orgSlug string
	_ = db.Pool.QueryRow(ctx, `SELECT slug FROM organizations WHERE id=$1`, orgID).Scan(&orgSlug)
	if orgSlug != "" {
		vis := storage.VisibilityFromBool(course.IsPublic)
		if initErr := storage.InitCourseHierarchy(ctx, orgSlug, vis, course.ID.String()); initErr != nil {
			log.Printf("[course] WARNING: could not init MinIO hierarchy for course %s: %v", course.ID, initErr)
		}
	}

	c.JSON(http.StatusCreated, course)
}

func ListCourses(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	role := c.GetString("role")

	var orgID uuid.UUID
	if orgIDStr != "" {
		var err error
		orgID, err = uuid.Parse(orgIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
			return
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var rows interface {
		Close()
		Next() bool
		Scan(...any) error
	}
	var err error

	if role == string(models.RoleUser) {
		rows, err = db.Pool.Query(ctx,
			`SELECT DISTINCT c.id, c.organization_id, c.title, c.description, c.thumbnail_key, c.modules, c.is_published, c.is_public, c.price, c.currency, c.validity_days, c.instructor_name, c.instructor_bio, c.created_at, c.updated_at
			 FROM courses c
			 WHERE c.is_published = TRUE AND (
			   c.is_public = TRUE OR c.organization_id = $1
			 )`, orgID)
	} else if role == string(models.RoleSuperAdmin) && orgIDStr == "" {
		rows, err = db.Pool.Query(ctx,
			`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, is_public, price, currency, validity_days, instructor_name, instructor_bio, created_at, updated_at
			 FROM courses`)
	} else {
		rows, err = db.Pool.Query(ctx,
			`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, is_public, price, currency, validity_days, instructor_name, instructor_bio, created_at, updated_at
			 FROM courses WHERE organization_id = $1`, orgID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch courses"})
		return
	}
	defer rows.Close()

	courses := []models.Course{}
	for rows.Next() {
		course, err := scanCourse(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode courses"})
			return
		}
		courses = append(courses, course)
	}
	c.JSON(http.StatusOK, courses)
}

func GetCourse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	row := db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, is_public, price, currency, validity_days, instructor_name, instructor_bio, created_at, updated_at
		 FROM courses WHERE id = $1`, id)
	course, err := scanCourse(row)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	role := c.GetString("role")
	if role == string(models.RoleUser) {
		userID, parseErr := uuid.Parse(c.GetString("user_id"))
		if parseErr != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
			return
		}

		var enrollmentID string
		errEnroll := db.Pool.QueryRow(ctx,
			`SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2`,
			userID, id).Scan(&enrollmentID)

		var assignmentID string
		errAssign := db.Pool.QueryRow(ctx,
			`SELECT id FROM user_course_assignments WHERE user_id=$1 AND course_id=$2`,
			userID, id).Scan(&assignmentID)

		if errEnroll != nil && errAssign != nil {
			course.IsEnrolled = false
			course.Modules = []models.Module{}
		} else {
			course.IsEnrolled = true
		}
	} else {
		course.IsEnrolled = true
	}

	c.JSON(http.StatusOK, course)
}

func GeneratePresignURL(c *gin.Context) {
	var req models.PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// SEC-003: Validate that the requested bucket is one of the known allowed buckets.
	// This prevents admins from generating presigned URLs for arbitrary bucket paths.
	allowedBuckets := map[string]bool{
		config.App.MinioBucketVids: true,
		config.App.MinioBucketDocs: true,
	}
	if !allowedBuckets[req.Bucket] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bucket: must be one of the configured storage buckets"})
		return
	}

	expiry := time.Duration(req.ExpiryMins) * time.Minute
	if expiry == 0 {
		expiry = 60 * time.Minute // default raised from 15→60 min; large video uploads need more time
	}
	// Cap expiry to 60 minutes to limit presigned URL lifetime
	if expiry > 60*time.Minute {
		expiry = 60 * time.Minute
	}

	log.Printf("[presign] bucket=%q object=%q expiry=%v", req.Bucket, req.ObjectName, expiry)

	putURL, err := storage.PresignedPutURL(req.Bucket, req.ObjectName, expiry)
	if err != nil {
		log.Printf("[presign] PresignedPutURL error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": putURL, "object_name": req.ObjectName})
}

// GenerateStudentPresignURL allows enrolled students (any authenticated user) to get a
// presigned PUT URL, but is restricted to the documents bucket only (for assignment uploads).
func GenerateStudentPresignURL(c *gin.Context) {
	var req models.PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// SEC-004: Students may only upload to the documents bucket, not videos.
	if req.Bucket != config.App.MinioBucketDocs {
		c.JSON(http.StatusBadRequest, gin.H{"error": "students may only upload to the documents bucket"})
		return
	}

	expiry := time.Duration(req.ExpiryMins) * time.Minute
	if expiry == 0 {
		expiry = 15 * time.Minute
	}
	if expiry > 30*time.Minute {
		expiry = 30 * time.Minute
	}

	log.Printf("[student-presign] bucket=%q object=%q expiry=%v", req.Bucket, req.ObjectName, expiry)

	putURL, err := storage.PresignedPutURL(req.Bucket, req.ObjectName, expiry)
	if err != nil {
		log.Printf("[student-presign] PresignedPutURL error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": putURL, "object_name": req.ObjectName})
}

func GeneratePresignGetURL(c *gin.Context) {
	objectName := c.Query("object_name")
	if objectName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "object_name query parameter is required"})
		return
	}

	bucket := c.Query("bucket")
	if bucket == "" {
		bucket = config.App.MinioBucketVids
	}

	expiry := 60 * time.Minute

	getURL, err := storage.PresignedGetURL(bucket, objectName, expiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned read URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": getURL, "object_name": objectName})
}

func UpdateCourse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	// BL-001: Verify the course belongs to the calling admin's organization
	// before making any changes, to prevent cross-org course modification.
	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var ownerOrgID uuid.UUID
	var oldIsPublic bool
	if err := db.Pool.QueryRow(ctx, `SELECT organization_id, is_public FROM courses WHERE id=$1`, id).Scan(&ownerOrgID, &oldIsPublic); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}
	if ownerOrgID != callerOrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: course belongs to a different organization"})
		return
	}

	var course models.Course
	if err := c.ShouldBindJSON(&course); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for i := range course.Modules {
		if course.Modules[i].ID == uuid.Nil {
			course.Modules[i].ID = uuid.New()
		}
		course.Modules[i].Order = i
		for j := range course.Modules[i].Materials {
			if course.Modules[i].Materials[j].ID == uuid.Nil {
				course.Modules[i].Materials[j].ID = uuid.New()
			}
			course.Modules[i].Materials[j].Order = j
		}
	}

	course.UpdatedAt = time.Now()
	modulesJSON, _ := json.Marshal(course.Modules)

	_, err = db.Pool.Exec(ctx,
		`UPDATE courses SET title=$1, description=$2, thumbnail_key=$3, modules=$4, is_published=$5, is_public=$6, price=$7, currency=$8, validity_days=$9, instructor_name=$10, instructor_bio=$11, updated_at=$12
		 WHERE id=$13`,
		course.Title, course.Description, course.ThumbnailKey, modulesJSON, course.IsPublished, course.IsPublic, course.Price, course.Currency, course.ValidityDays,
		course.InstructorName, course.InstructorBio, course.UpdatedAt, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update course"})
		return
	}

	// If visibility changed, move storage objects between private/ and public/.
	if oldIsPublic != course.IsPublic {
		var orgSlug string
		_ = db.Pool.QueryRow(ctx, `SELECT slug FROM organizations WHERE id=$1`, callerOrgID).Scan(&orgSlug)
		if orgSlug != "" {
			from := storage.VisibilityFromBool(oldIsPublic)
			to := storage.VisibilityFromBool(course.IsPublic)
			if moveErr := storage.MoveCourseVisibility(ctx, orgSlug, id.String(), from, to); moveErr != nil {
				log.Printf("[course] WARNING: could not move course %s storage from %s to %s: %v", id, from, to, moveErr)
			}
		}
	}

	c.JSON(http.StatusOK, course)
}

func DeleteCourse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	// BL-001: Verify the course belongs to the calling admin's organization
	// before deleting, to prevent cross-org course deletion.
	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	callerUserID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var ownerOrgID uuid.UUID
	var courseIsPublic bool
	var courseTitle string
	if err := db.Pool.QueryRow(ctx, `SELECT organization_id, is_public, title FROM courses WHERE id=$1`, id).Scan(&ownerOrgID, &courseIsPublic, &courseTitle); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}
	if ownerOrgID != callerOrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: course belongs to a different organization"})
		return
	}

	// Fetch caller name/email for audit log
	var callerName, callerEmail string
	_ = db.Pool.QueryRow(ctx, `SELECT name, email FROM users WHERE id=$1`, callerUserID).Scan(&callerName, &callerEmail)

	// Insert deletion audit log BEFORE deleting the course
	logID := uuid.New()
	_, logErr := db.Pool.Exec(ctx,
		`INSERT INTO course_delete_logs (id, course_id, course_title, organization_id, deleted_by, deleted_by_name, deleted_by_email, deleted_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		logID, id, courseTitle, ownerOrgID, callerUserID, callerName, callerEmail, time.Now(),
	)
	if logErr != nil {
		log.Printf("[course] WARNING: could not write delete log for course %s: %v", id, logErr)
	}

	if _, err := db.Pool.Exec(ctx, `DELETE FROM courses WHERE id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete course"})
		return
	}

	// Clean up all storage objects for this course.
	var orgSlug string
	_ = db.Pool.QueryRow(ctx, `SELECT slug FROM organizations WHERE id=$1`, callerOrgID).Scan(&orgSlug)
	if orgSlug != "" {
		vis := storage.VisibilityFromBool(courseIsPublic)
		prefix := storage.CoursePrefix(orgSlug, vis, id.String())
		if delErr := storage.DeletePrefix(ctx, prefix); delErr != nil {
			log.Printf("[course] WARNING: could not clean up storage for deleted course %s: %v", id, delErr)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "course deleted"})
}

// DeleteCourseContent deletes a single object (video/document) from a course's
// storage in MinIO. The admin can then re-upload a replacement.
//
// DELETE /api/courses/:id/content?object_key=...
func DeleteCourseContent(c *gin.Context) {
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	objectKey := c.Query("object_key")
	if objectKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "object_key query parameter is required"})
		return
	}

	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify ownership
	orgSlug, visibility, err := resolveCourseMeta(ctx, courseID, callerOrgID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Safety check: ensure the object_key starts with this course's prefix
	coursePrefix := storage.CoursePrefix(orgSlug, visibility, courseID.String())
	if len(objectKey) < len(coursePrefix) || objectKey[:len(coursePrefix)] != coursePrefix {
		c.JSON(http.StatusForbidden, gin.H{"error": "object does not belong to this course"})
		return
	}

	if err := storage.DeleteObject(ctx, objectKey); err != nil {
		log.Printf("[course-content] delete error for %q: %v", objectKey, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete object"})
		return
	}

	log.Printf("[course-content] deleted object %q from course %s", objectKey, courseID)
	c.JSON(http.StatusOK, gin.H{"message": "content deleted", "object_key": objectKey})
}

// GetCourseDeleteLogs returns the deletion audit log for courses within an
// organization. Admins see logs for their own org; super_admins see all.
//
// GET /api/admin/course-delete-logs
func GetCourseDeleteLogs(c *gin.Context) {
	role := c.GetString("role")
	orgIDStr := c.GetString("org_id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var rows interface {
		Close()
		Next() bool
		Scan(...any) error
	}
	var queryErr error

	if role == string(models.RoleSuperAdmin) {
		rows, queryErr = db.Pool.Query(ctx,
			`SELECT cdl.id, cdl.course_id, cdl.course_title, cdl.organization_id, cdl.deleted_by, cdl.deleted_by_name, cdl.deleted_by_email, cdl.deleted_at
			 FROM course_delete_logs cdl
			 ORDER BY cdl.deleted_at DESC
			 LIMIT 200`)
	} else {
		orgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
			return
		}
		rows, queryErr = db.Pool.Query(ctx,
			`SELECT cdl.id, cdl.course_id, cdl.course_title, cdl.organization_id, cdl.deleted_by, cdl.deleted_by_name, cdl.deleted_by_email, cdl.deleted_at
			 FROM course_delete_logs cdl
			 WHERE cdl.organization_id = $1
			 ORDER BY cdl.deleted_at DESC
			 LIMIT 200`, orgID)
	}

	if queryErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch delete logs"})
		return
	}
	defer rows.Close()

	logs := []models.CourseDeleteLog{}
	for rows.Next() {
		var l models.CourseDeleteLog
		if err := rows.Scan(&l.ID, &l.CourseID, &l.CourseTitle, &l.OrganizationID, &l.DeletedBy, &l.DeletedByName, &l.DeletedByEmail, &l.DeletedAt); err != nil {
			continue
		}
		logs = append(logs, l)
	}

	c.JSON(http.StatusOK, logs)
}
