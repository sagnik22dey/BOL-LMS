// Package storage provides the hierarchical MinIO storage architecture for
// the BOL-LMS platform.
//
// # Architecture Overview
//
// A single unified bucket (configured via MINIO_BUCKET_LMS, default "bol-lms")
// holds ALL organisation-scoped content.  Object key prefixes encode the full
// hierarchy:
//
//	{org-slug}/{visibility}/{course-id}/videos/
//	{org-slug}/{visibility}/{course-id}/docs/
//	{org-slug}/{visibility}/{course-id}/assignments/{student-id}/
//
// Where:
//   - org-slug    — the URL-safe slug of the organisation (e.g. "org-alpha")
//   - visibility  — either "private" or "public", mirroring the course's IsPublic flag
//   - course-id   — the UUID of the course
//   - student-id  — the UUID of the student (used only inside assignments/)
//
// # Why a single bucket with prefixes?
//
//  1. **Simpler policy management** — one bucket policy covers all orgs.
//  2. **No bucket-count limits** — MinIO has no hard cap but thousands of
//     buckets degrade listing performance.
//  3. **Uniform presigned URL generation** — every URL targets the same bucket;
//     only the object key changes.
//  4. **Easier backup / replication** — a single bucket is trivially mirrored.
//
// The legacy per-type buckets (bol-lms-videos, bol-lms-documents) are kept for
// backward compatibility; new uploads should use the hierarchical paths.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"bol-lms-server/config"

	"github.com/minio/minio-go/v7"
)

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// CourseVisibility represents the public/private classification of a course.
type CourseVisibility string

const (
	VisibilityPrivate CourseVisibility = "private"
	VisibilityPublic  CourseVisibility = "public"
)

// ContentType represents the three sub-directories inside every course prefix.
type ContentType string

const (
	ContentTypeVideos      ContentType = "videos"
	ContentTypeDocs        ContentType = "docs"
	ContentTypeAssignments ContentType = "assignments"
)

// ─────────────────────────────────────────────────────────────────────────────
// Path builders  — pure functions, no I/O
// ─────────────────────────────────────────────────────────────────────────────

// OrgPrefix returns the top-level prefix for an organization.
//
//	e.g. "org-alpha/"
func OrgPrefix(orgSlug string) string {
	return fmt.Sprintf("%s/", sanitizeSlug(orgSlug))
}

// CoursePrefix returns the full prefix for a course including visibility.
//
//	e.g. "org-alpha/private/550e8400-e29b-41d4-a716-446655440000/"
func CoursePrefix(orgSlug string, visibility CourseVisibility, courseID string) string {
	return fmt.Sprintf("%s%s/%s/", OrgPrefix(orgSlug), visibility, courseID)
}

// ContentPrefix returns the prefix for a specific content type inside a course.
//
//	e.g. "org-alpha/private/550e8400-e29b-41d4-a716-446655440000/videos/"
func ContentPrefix(orgSlug string, visibility CourseVisibility, courseID string, ct ContentType) string {
	return fmt.Sprintf("%s%s/", CoursePrefix(orgSlug, visibility, courseID), ct)
}

// StudentAssignmentPrefix returns the per-student prefix inside the assignments
// directory of a course.  This ensures students can only see their own work.
//
//	e.g. "org-alpha/private/<course-id>/assignments/<student-id>/"
func StudentAssignmentPrefix(orgSlug string, visibility CourseVisibility, courseID, studentID string) string {
	return fmt.Sprintf("%sassignments/%s/", CoursePrefix(orgSlug, visibility, courseID), studentID)
}

// VideoObjectKey returns the full object key for a video file.
func VideoObjectKey(orgSlug string, visibility CourseVisibility, courseID, filename string) string {
	return ContentPrefix(orgSlug, visibility, courseID, ContentTypeVideos) + filename
}

// DocObjectKey returns the full object key for a document file.
func DocObjectKey(orgSlug string, visibility CourseVisibility, courseID, filename string) string {
	return ContentPrefix(orgSlug, visibility, courseID, ContentTypeDocs) + filename
}

// AssignmentObjectKey returns the full object key for a student assignment file.
func AssignmentObjectKey(orgSlug string, visibility CourseVisibility, courseID, studentID, filename string) string {
	return StudentAssignmentPrefix(orgSlug, visibility, courseID, studentID) + filename
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket & hierarchy initialisation
// ─────────────────────────────────────────────────────────────────────────────

// InitLMSBucket ensures the unified LMS bucket exists and sets a default
// read-only public policy for public course prefixes. Call this during server
// startup after Connect().
func InitLMSBucket() {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		log.Println("[hierarchy] MINIO_BUCKET_LMS not set — skipping hierarchical storage init")
		return
	}
	ensureBucket(bucket)
	log.Printf("[hierarchy] unified LMS bucket ready: %s", bucket)
}

// InitOrgHierarchy creates the placeholder prefixes for a new organization.
// MinIO doesn't have real "directories", so we create zero-byte marker objects.
//
// Resulting prefixes:
//
//	{org-slug}/private/
//	{org-slug}/public/
func InitOrgHierarchy(ctx context.Context, orgSlug string) error {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	slug := sanitizeSlug(orgSlug)
	markers := []string{
		fmt.Sprintf("%s/private/.keep", slug),
		fmt.Sprintf("%s/public/.keep", slug),
	}

	for _, key := range markers {
		if err := putMarker(ctx, bucket, key); err != nil {
			return fmt.Errorf("creating org marker %q: %w", key, err)
		}
	}

	log.Printf("[hierarchy] org hierarchy initialised: %s/{private,public}/", slug)
	return nil
}

// InitCourseHierarchy creates the three sub-directory markers for a new course.
//
// Resulting prefixes:
//
//	{org-slug}/{visibility}/{course-id}/videos/
//	{org-slug}/{visibility}/{course-id}/docs/
//	{org-slug}/{visibility}/{course-id}/assignments/
func InitCourseHierarchy(ctx context.Context, orgSlug string, visibility CourseVisibility, courseID string) error {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	base := CoursePrefix(orgSlug, visibility, courseID)
	markers := []string{
		base + "videos/.keep",
		base + "docs/.keep",
		base + "assignments/.keep",
	}

	for _, key := range markers {
		if err := putMarker(ctx, bucket, key); err != nil {
			return fmt.Errorf("creating course marker %q: %w", key, err)
		}
	}

	log.Printf("[hierarchy] course hierarchy initialised: %s{videos,docs,assignments}/", base)
	return nil
}

// InitStudentAssignmentDir creates the per-student prefix inside a course's
// assignments directory.
//
// Resulting prefix:
//
//	{org-slug}/{visibility}/{course-id}/assignments/{student-id}/
func InitStudentAssignmentDir(ctx context.Context, orgSlug string, visibility CourseVisibility, courseID, studentID string) error {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	key := StudentAssignmentPrefix(orgSlug, visibility, courseID, studentID) + ".keep"
	if err := putMarker(ctx, bucket, key); err != nil {
		return fmt.Errorf("creating student assignment marker %q: %w", key, err)
	}

	log.Printf("[hierarchy] student assignment dir initialised: %s",
		StudentAssignmentPrefix(orgSlug, visibility, courseID, studentID))
	return nil
}

// MoveCourseVisibility moves all objects from one visibility prefix to another
// when a course's IsPublic flag changes. This is a copy+delete operation.
func MoveCourseVisibility(ctx context.Context, orgSlug string, courseID string, from, to CourseVisibility) error {
	if from == to {
		return nil
	}

	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	srcPrefix := CoursePrefix(orgSlug, from, courseID)
	dstPrefix := CoursePrefix(orgSlug, to, courseID)

	log.Printf("[hierarchy] moving course %s: %s → %s", courseID, srcPrefix, dstPrefix)

	// List all objects under source prefix
	objectsCh := Client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    srcPrefix,
		Recursive: true,
	})

	for obj := range objectsCh {
		if obj.Err != nil {
			return fmt.Errorf("listing source objects: %w", obj.Err)
		}

		newKey := strings.Replace(obj.Key, srcPrefix, dstPrefix, 1)

		// Copy object to new location
		_, err := Client.CopyObject(ctx,
			minio.CopyDestOptions{Bucket: bucket, Object: newKey},
			minio.CopySrcOptions{Bucket: bucket, Object: obj.Key},
		)
		if err != nil {
			return fmt.Errorf("copying %q → %q: %w", obj.Key, newKey, err)
		}

		// Remove original
		if err := Client.RemoveObject(ctx, bucket, obj.Key, minio.RemoveObjectOptions{}); err != nil {
			log.Printf("[hierarchy] WARNING: could not remove source object %q after copy: %v", obj.Key, err)
		}
	}

	log.Printf("[hierarchy] course %s moved from %s to %s", courseID, from, to)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Presigned URL helpers (hierarchical)
// ─────────────────────────────────────────────────────────────────────────────

// HierarchicalPresignPut generates a presigned PUT URL for uploading to the
// hierarchical LMS bucket.
func HierarchicalPresignPut(objectKey string, expiry time.Duration) (string, error) {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return "", fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}
	return PresignedPutURL(bucket, objectKey, expiry)
}

// HierarchicalPresignGet generates a presigned GET URL for reading from the
// hierarchical LMS bucket.
func HierarchicalPresignGet(objectKey string, expiry time.Duration) (string, error) {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return "", fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}
	return PresignedGetURL(bucket, objectKey, expiry)
}

// ─────────────────────────────────────────────────────────────────────────────
// List helpers
// ─────────────────────────────────────────────────────────────────────────────

// ListObjects returns all object keys under a given prefix in the LMS bucket.
func ListObjects(ctx context.Context, prefix string, recursive bool) ([]minio.ObjectInfo, error) {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return nil, fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	var objects []minio.ObjectInfo
	objectsCh := Client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: recursive,
	})

	for obj := range objectsCh {
		if obj.Err != nil {
			return nil, obj.Err
		}
		// Skip .keep marker files from results
		if strings.HasSuffix(obj.Key, ".keep") {
			continue
		}
		objects = append(objects, obj)
	}
	return objects, nil
}

// ListStudentAssignments lists all assignment files for a specific student in a
// specific course.
func ListStudentAssignments(ctx context.Context, orgSlug string, visibility CourseVisibility, courseID, studentID string) ([]minio.ObjectInfo, error) {
	prefix := StudentAssignmentPrefix(orgSlug, visibility, courseID, studentID)
	return ListObjects(ctx, prefix, true)
}

// ListCourseVideos lists all video files for a specific course.
func ListCourseVideos(ctx context.Context, orgSlug string, visibility CourseVisibility, courseID string) ([]minio.ObjectInfo, error) {
	prefix := ContentPrefix(orgSlug, visibility, courseID, ContentTypeVideos)
	return ListObjects(ctx, prefix, true)
}

// ListCourseDocs lists all document files for a specific course.
func ListCourseDocs(ctx context.Context, orgSlug string, visibility CourseVisibility, courseID string) ([]minio.ObjectInfo, error) {
	prefix := ContentPrefix(orgSlug, visibility, courseID, ContentTypeDocs)
	return ListObjects(ctx, prefix, true)
}

// DeleteObject removes a single object from the LMS bucket.
func DeleteObject(ctx context.Context, objectKey string) error {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}
	return Client.RemoveObject(ctx, bucket, objectKey, minio.RemoveObjectOptions{})
}

// DeletePrefix removes all objects under a prefix in the LMS bucket.
// Use with caution — this is destructive.
func DeletePrefix(ctx context.Context, prefix string) error {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	objectsCh := Client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for obj := range objectsCh {
		if obj.Err != nil {
			return obj.Err
		}
		if err := Client.RemoveObject(ctx, bucket, obj.Key, minio.RemoveObjectOptions{}); err != nil {
			log.Printf("[hierarchy] WARNING: could not remove %q: %v", obj.Key, err)
		}
	}
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket policy helpers
// ─────────────────────────────────────────────────────────────────────────────

// BucketPolicyStatement represents a single statement in a MinIO bucket policy.
type BucketPolicyStatement struct {
	Sid       string            `json:"Sid,omitempty"`
	Effect    string            `json:"Effect"`
	Principal map[string]string `json:"Principal"`
	Action    []string          `json:"Action"`
	Resource  []string          `json:"Resource"`
}

// BucketPolicy represents a MinIO/S3 bucket policy document.
type BucketPolicy struct {
	Version   string                  `json:"Version"`
	Statement []BucketPolicyStatement `json:"Statement"`
}

// SetPublicReadPolicyForOrg sets a bucket policy that allows anonymous read
// access to the public/ prefix of an organization while keeping the private/
// prefix restricted.
func SetPublicReadPolicyForOrg(ctx context.Context, orgSlug string) error {
	bucket := config.App.MinioBucketLMS
	if bucket == "" {
		return fmt.Errorf("MINIO_BUCKET_LMS is not configured")
	}

	slug := sanitizeSlug(orgSlug)

	// Get existing policy
	existingPolicy, err := getExistingPolicy(ctx, bucket)
	if err != nil {
		log.Printf("[hierarchy] no existing policy found, creating new one: %v", err)
		existingPolicy = &BucketPolicy{
			Version:   "2012-10-17",
			Statement: []BucketPolicyStatement{},
		}
	}

	// Build the new statement for this org's public prefix
	sid := fmt.Sprintf("PublicRead-%s", slug)
	newStatement := BucketPolicyStatement{
		Sid:       sid,
		Effect:    "Allow",
		Principal: map[string]string{"AWS": "*"},
		Action:    []string{"s3:GetObject"},
		Resource: []string{
			fmt.Sprintf("arn:aws:s3:::%s/%s/public/*", bucket, slug),
		},
	}

	// Replace or append the statement
	found := false
	for i, s := range existingPolicy.Statement {
		if s.Sid == sid {
			existingPolicy.Statement[i] = newStatement
			found = true
			break
		}
	}
	if !found {
		existingPolicy.Statement = append(existingPolicy.Statement, newStatement)
	}

	policyJSON, err := json.Marshal(existingPolicy)
	if err != nil {
		return fmt.Errorf("marshalling policy: %w", err)
	}

	if err := Client.SetBucketPolicy(ctx, bucket, string(policyJSON)); err != nil {
		return fmt.Errorf("setting bucket policy: %w", err)
	}

	log.Printf("[hierarchy] public read policy set for org %q on %s/%s/public/*", slug, bucket, slug)
	return nil
}

// SetAdminWritePolicy creates a policy statement that restricts write access
// for video and docs content to admin-only presigned URLs. Since presigned URLs
// are generated server-side after role verification, this is primarily
// documentation and defense-in-depth.
//
// Note: In practice, access control for uploads is enforced at the application
// layer via presigned URL generation — only handlers gated by admin middleware
// can generate PUT URLs for videos/ and docs/ prefixes.
func SetAdminWritePolicy(ctx context.Context, orgSlug string) error {
	// This is a no-op in the current architecture because:
	// 1. All uploads use presigned URLs generated server-side
	// 2. Admin middleware gates the presign endpoint for videos/docs
	// 3. Student middleware gates the presign endpoint for assignments
	//
	// The actual IAM-level enforcement would require MinIO's built-in IAM
	// system with per-user credentials, which is overkill for this setup.
	// Instead, we rely on application-layer access control.
	log.Printf("[hierarchy] admin write policy noted for org %q (enforced at application layer)", orgSlug)
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

// putMarker creates a zero-byte .keep object to materialise a "directory" in
// MinIO.  If the marker already exists it is silently overwritten.
func putMarker(ctx context.Context, bucket, key string) error {
	_, err := Client.PutObject(ctx, bucket, key,
		bytes.NewReader([]byte{}), 0,
		minio.PutObjectOptions{ContentType: "application/x-directory"},
	)
	return err
}

// sanitizeSlug normalises an org slug for use as an object-key prefix.
// Lowercases and strips leading/trailing slashes.
func sanitizeSlug(slug string) string {
	s := strings.ToLower(strings.TrimSpace(slug))
	s = strings.Trim(s, "/")
	return s
}

// getExistingPolicy fetches and parses the current bucket policy.
func getExistingPolicy(ctx context.Context, bucket string) (*BucketPolicy, error) {
	policyStr, err := Client.GetBucketPolicy(ctx, bucket)
	if err != nil {
		return nil, err
	}
	if policyStr == "" {
		return nil, fmt.Errorf("empty policy")
	}

	var policy BucketPolicy
	if err := json.Unmarshal([]byte(policyStr), &policy); err != nil {
		return nil, fmt.Errorf("parsing policy JSON: %w", err)
	}
	return &policy, nil
}

// VisibilityFromBool converts a boolean IsPublic flag to CourseVisibility.
func VisibilityFromBool(isPublic bool) CourseVisibility {
	if isPublic {
		return VisibilityPublic
	}
	return VisibilityPrivate
}
