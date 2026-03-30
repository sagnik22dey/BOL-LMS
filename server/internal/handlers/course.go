package handlers

import (
	"context"
	"encoding/json"
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
		&c.ThumbnailKey, &rawModules, &c.IsPublished, &c.CreatedAt, &c.UpdatedAt)
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

	now := time.Now()
	course := models.Course{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Title:          req.Title,
		Description:    req.Description,
		Modules:        []models.Module{},
		IsPublished:    false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	modulesJSON, _ := json.Marshal(course.Modules)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO courses (id, organization_id, title, description, thumbnail_key, modules, is_published, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		course.ID, course.OrganizationID, course.Title, course.Description, course.ThumbnailKey,
		modulesJSON, course.IsPublished, course.CreatedAt, course.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create course"})
		return
	}
	c.JSON(http.StatusCreated, course)
}

func ListCourses(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	if orgIDStr == "" {
		c.JSON(http.StatusOK, []models.Course{})
		return
	}

	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	role := c.GetString("role")
	var rows interface {
		Close()
		Next() bool
		Scan(...any) error
	}

	if role == string(models.RoleUser) {
		userID, _ := uuid.Parse(c.GetString("user_id"))

		rows, err = db.Pool.Query(ctx,
			`SELECT DISTINCT c.id, c.organization_id, c.title, c.description, c.thumbnail_key, c.modules, c.is_published, c.created_at, c.updated_at
			 FROM courses c
			 WHERE c.organization_id = $1 AND c.is_published = TRUE AND (
			   c.id IN (SELECT course_id FROM user_course_assignments WHERE user_id = $2)
			   OR c.id IN (SELECT course_id FROM group_courses WHERE group_id IN (SELECT group_id FROM group_users WHERE user_id = $2))
			 )`, orgID, userID)
	} else {
		rows, err = db.Pool.Query(ctx,
			`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, created_at, updated_at
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
		`SELECT id, organization_id, title, description, thumbnail_key, modules, is_published, created_at, updated_at
		 FROM courses WHERE id = $1`, id)
	course, err := scanCourse(row)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}
	c.JSON(http.StatusOK, course)
}

func GeneratePresignURL(c *gin.Context) {
	var req models.PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expiry := time.Duration(req.ExpiryMins) * time.Minute
	if expiry == 0 {
		expiry = 15 * time.Minute
	}

	putURL, err := storage.PresignedPutURL(req.Bucket, req.ObjectName, expiry)
	if err != nil {
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`UPDATE courses SET title=$1, description=$2, thumbnail_key=$3, modules=$4, is_published=$5, updated_at=$6
		 WHERE id=$7`,
		course.Title, course.Description, course.ThumbnailKey, modulesJSON, course.IsPublished, course.UpdatedAt, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update course"})
		return
	}
	c.JSON(http.StatusOK, course)
}

func DeleteCourse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Pool.Exec(ctx, `DELETE FROM courses WHERE id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete course"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "course deleted"})
}
