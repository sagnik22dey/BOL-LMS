package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"bol-lms-server/config"
	"bol-lms-server/internal/db"
	"bol-lms-server/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────────────────────
// Request / response types
// ─────────────────────────────────────────────────────────────────────────────

// HierarchicalPresignRequest is the request body for hierarchical presigned URL
// generation. The server constructs the full object key from these fields
// instead of accepting an arbitrary bucket+key from the client.
type HierarchicalPresignRequest struct {
	CourseID    string `json:"course_id" binding:"required"`
	ContentType string `json:"content_type" binding:"required"` // "videos", "docs", or "assignments"
	Filename    string `json:"filename" binding:"required"`
	ExpiryMins  int    `json:"expiry_mins"`
}

// HierarchicalPresignResponse is returned to the client with the upload URL
// and the normalised object key for later reference.
type HierarchicalPresignResponse struct {
	URL       string `json:"url"`
	ObjectKey string `json:"object_key"`
	Bucket    string `json:"bucket"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin presign PUT — videos & docs
// ─────────────────────────────────────────────────────────────────────────────

// GenerateHierarchicalPresignPut generates a presigned PUT URL for admin uploads
// (videos and docs) using the hierarchical path structure.
//
// Only admins may call this endpoint. The handler verifies that the course
// belongs to the caller's organization before generating the URL.
//
// POST /api/courses/h-presign
func GenerateHierarchicalPresignPut(c *gin.Context) {
	var req HierarchicalPresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate content type — admins can only upload to videos or docs.
	ct := storage.ContentType(req.ContentType)
	if ct != storage.ContentTypeVideos && ct != storage.ContentTypeDocs {
		c.JSON(http.StatusBadRequest, gin.H{"error": "admin uploads must target 'videos' or 'docs'"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Verify course ownership
	orgSlug, visibility, err := resolveCourseMeta(ctx, courseID, callerOrgID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Build the full object key
	filename := sanitizeFilename(req.Filename)
	var objectKey string
	if ct == storage.ContentTypeVideos {
		objectKey = storage.VideoObjectKey(orgSlug, visibility, courseID.String(), filename)
	} else {
		objectKey = storage.DocObjectKey(orgSlug, visibility, courseID.String(), filename)
	}

	expiry := resolveExpiry(req.ExpiryMins, 60, 60)

	putURL, err := storage.HierarchicalPresignPut(objectKey, expiry)
	if err != nil {
		log.Printf("[h-presign] error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned URL"})
		return
	}

	c.JSON(http.StatusOK, HierarchicalPresignResponse{
		URL:       putURL,
		ObjectKey: objectKey,
		Bucket:    config.App.MinioBucketLMS,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Student presign PUT — assignments only
// ─────────────────────────────────────────────────────────────────────────────

// GenerateStudentHierarchicalPresignPut generates a presigned PUT URL for
// student assignment uploads using the hierarchical path structure.
//
// The object key is scoped to the student's own directory:
//
//	{org}/{visibility}/{course}/assignments/{student-id}/{filename}
//
// POST /api/learning/h-presign-put
func GenerateStudentHierarchicalPresignPut(c *gin.Context) {
	var req HierarchicalPresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Students can only upload to assignments.
	if req.ContentType != string(storage.ContentTypeAssignments) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "students may only upload to 'assignments'"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Look up course org + visibility (no org ownership check — students can be
	// enrolled in any org's courses).
	orgSlug, visibility, err := resolveCourseMetaAny(ctx, courseID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Ensure the student's assignment directory exists.
	if initErr := storage.InitStudentAssignmentDir(ctx, orgSlug, visibility, courseID.String(), userID.String()); initErr != nil {
		log.Printf("[h-presign-student] WARNING: could not init student dir: %v", initErr)
	}

	filename := sanitizeFilename(req.Filename)
	objectKey := storage.AssignmentObjectKey(orgSlug, visibility, courseID.String(), userID.String(), filename)

	expiry := resolveExpiry(req.ExpiryMins, 15, 30)

	putURL, err := storage.HierarchicalPresignPut(objectKey, expiry)
	if err != nil {
		log.Printf("[h-presign-student] error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned URL"})
		return
	}

	c.JSON(http.StatusOK, HierarchicalPresignResponse{
		URL:       putURL,
		ObjectKey: objectKey,
		Bucket:    config.App.MinioBucketLMS,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical presign GET — any authenticated user
// ─────────────────────────────────────────────────────────────────────────────

// GenerateHierarchicalPresignGet generates a presigned GET URL for reading
// objects from the hierarchical LMS bucket.
//
// GET /api/learning/h-presign-get?object_key=...
func GenerateHierarchicalPresignGet(c *gin.Context) {
	objectKey := c.Query("object_key")
	if objectKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "object_key query parameter is required"})
		return
	}

	// Validate that the key is within the LMS hierarchy (basic path traversal
	// protection).
	if strings.Contains(objectKey, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object_key"})
		return
	}

	expiry := 60 * time.Minute

	getURL, err := storage.HierarchicalPresignGet(objectKey, expiry)
	if err != nil {
		log.Printf("[h-presign-get] error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned read URL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":        getURL,
		"object_key": objectKey,
		"bucket":     config.App.MinioBucketLMS,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// List course content — admin
// ─────────────────────────────────────────────────────────────────────────────

// ListCourseContent returns a listing of all objects in a specific content type
// directory for a course.
//
// GET /api/courses/:id/content?type=videos|docs|assignments
func ListCourseContent(c *gin.Context) {
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	contentType := c.Query("type")
	if contentType == "" {
		contentType = "videos"
	}
	ct := storage.ContentType(contentType)
	if ct != storage.ContentTypeVideos && ct != storage.ContentTypeDocs && ct != storage.ContentTypeAssignments {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'videos', 'docs', or 'assignments'"})
		return
	}

	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	orgSlug, visibility, err := resolveCourseMeta(ctx, courseID, callerOrgID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	prefix := storage.ContentPrefix(orgSlug, visibility, courseID.String(), ct)
	objects, err := storage.ListObjects(ctx, prefix, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list objects"})
		return
	}

	type ObjectInfo struct {
		Key          string    `json:"key"`
		Size         int64     `json:"size"`
		LastModified time.Time `json:"last_modified"`
	}

	result := make([]ObjectInfo, 0, len(objects))
	for _, obj := range objects {
		result = append(result, ObjectInfo{
			Key:          obj.Key,
			Size:         obj.Size,
			LastModified: obj.LastModified,
		})
	}

	c.JSON(http.StatusOK, gin.H{"objects": result, "prefix": prefix})
}

// ─────────────────────────────────────────────────────────────────────────────
// List student's own assignments
// ─────────────────────────────────────────────────────────────────────────────

// ListMyAssignmentFiles returns a listing of the authenticated student's own
// assignment files for a specific course.
//
// GET /api/learning/courses/:id/my-assignments
func ListMyAssignmentFiles(c *gin.Context) {
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	orgSlug, visibility, err := resolveCourseMetaAny(ctx, courseID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	objects, err := storage.ListStudentAssignments(ctx, orgSlug, visibility, courseID.String(), userID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list assignment files"})
		return
	}

	type ObjectInfo struct {
		Key          string    `json:"key"`
		Size         int64     `json:"size"`
		LastModified time.Time `json:"last_modified"`
	}

	result := make([]ObjectInfo, 0, len(objects))
	for _, obj := range objects {
		result = append(result, ObjectInfo{
			Key:          obj.Key,
			Size:         obj.Size,
			LastModified: obj.LastModified,
		})
	}

	c.JSON(http.StatusOK, gin.H{"objects": result})
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

// resolveCourseMeta fetches the org slug and visibility for a course, verifying
// the course belongs to callerOrgID.
func resolveCourseMeta(ctx context.Context, courseID, callerOrgID uuid.UUID) (string, storage.CourseVisibility, error) {
	var orgID uuid.UUID
	var isPublic bool
	err := db.Pool.QueryRow(ctx,
		`SELECT c.organization_id, c.is_public
		 FROM courses c WHERE c.id=$1`, courseID).Scan(&orgID, &isPublic)
	if err != nil {
		return "", "", fmt.Errorf("course not found")
	}
	if orgID != callerOrgID {
		return "", "", fmt.Errorf("access denied: course belongs to a different organization")
	}

	var orgSlug string
	if err := db.Pool.QueryRow(ctx, `SELECT slug FROM organizations WHERE id=$1`, orgID).Scan(&orgSlug); err != nil {
		return "", "", fmt.Errorf("organization not found")
	}

	return orgSlug, storage.VisibilityFromBool(isPublic), nil
}

// resolveCourseMetaAny fetches org slug and visibility without checking
// ownership (used for student access where enrollment is the gate).
func resolveCourseMetaAny(ctx context.Context, courseID uuid.UUID) (string, storage.CourseVisibility, error) {
	var orgID uuid.UUID
	var isPublic bool
	err := db.Pool.QueryRow(ctx,
		`SELECT organization_id, is_public FROM courses WHERE id=$1`, courseID).Scan(&orgID, &isPublic)
	if err != nil {
		return "", "", fmt.Errorf("course not found")
	}

	var orgSlug string
	if err := db.Pool.QueryRow(ctx, `SELECT slug FROM organizations WHERE id=$1`, orgID).Scan(&orgSlug); err != nil {
		return "", "", fmt.Errorf("organization not found")
	}

	return orgSlug, storage.VisibilityFromBool(isPublic), nil
}

// sanitizeFilename removes path separators from a filename to prevent
// directory traversal.
func sanitizeFilename(name string) string {
	// Strip any directory components
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	name = strings.ReplaceAll(name, "..", "_")
	name = strings.TrimSpace(name)
	if name == "" {
		name = "unnamed"
	}
	return name
}

// resolveExpiry calculates the expiry duration with a default and cap.
func resolveExpiry(requestedMins, defaultMins, capMins int) time.Duration {
	expiry := time.Duration(requestedMins) * time.Minute
	if expiry == 0 {
		expiry = time.Duration(defaultMins) * time.Minute
	}
	cap := time.Duration(capMins) * time.Minute
	if expiry > cap {
		expiry = cap
	}
	return expiry
}
