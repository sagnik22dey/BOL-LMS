package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/config"
	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"
	"bol-lms-server/internal/storage"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func CreateCourse(c *gin.Context) {
	orgID, err := primitive.ObjectIDFromHex(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	var req models.CreateCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	course := models.Course{
		ID:             primitive.NewObjectID(),
		OrganizationID: orgID,
		Title:          req.Title,
		Description:    req.Description,
		Modules:        []models.Module{},
		IsPublished:    false,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("courses").InsertOne(ctx, course); err != nil {
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

	orgID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"organization_id": orgID}
	
	// If the caller is a user (not an admin/super_admin), only show assigned and published courses
	role := c.GetString("role")
	if role == string(models.RoleUser) {
		userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
		
		var assignments []models.UserCourseAssignment
		cursor, err := db.Collection("user_course_assignments").Find(ctx, bson.M{"user_id": userID})
		if err == nil {
			cursor.All(ctx, &assignments)
			cursor.Close(ctx)
		}

		var groups []models.Group
		cursorGroup, errGroup := db.Collection("groups").Find(ctx, bson.M{"user_ids": userID})
		if errGroup == nil {
			cursorGroup.All(ctx, &groups)
			cursorGroup.Close(ctx)
		}
		
		uniqueCourseIDs := make(map[primitive.ObjectID]bool)
		for _, a := range assignments {
			uniqueCourseIDs[a.CourseID] = true
		}
		for _, g := range groups {
			for _, cid := range g.CourseIDs {
				uniqueCourseIDs[cid] = true
			}
		}

		var allowedCourseIDs []primitive.ObjectID
		for cid := range uniqueCourseIDs {
			allowedCourseIDs = append(allowedCourseIDs, cid)
		}

		if len(allowedCourseIDs) == 0 {
			c.JSON(http.StatusOK, []models.Course{})
			return
		}

		filter["_id"] = bson.M{"$in": allowedCourseIDs}
		filter["is_published"] = true
	}

	cursor, err := db.Collection("courses").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch courses"})
		return
	}
	defer cursor.Close(ctx)

	var courses []models.Course
	if err := cursor.All(ctx, &courses); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode courses"})
		return
	}
	c.JSON(http.StatusOK, courses)
}

func GetCourse(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var course models.Course
	if err := db.Collection("courses").FindOne(ctx, bson.M{"_id": id}).Decode(&course); err != nil {
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
		// Default to videos bucket if not specified
		bucket = config.App.MinioBucketVids
	}

	// 1 hour expiry for reading
	expiry := 60 * time.Minute 

	getURL, err := storage.PresignedGetURL(bucket, objectName, expiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate presigned read URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": getURL, "object_name": objectName})
}

func UpdateCourse(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
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
		if course.Modules[i].ID.IsZero() {
			course.Modules[i].ID = primitive.NewObjectID()
		}
		course.Modules[i].Order = i
		for j := range course.Modules[i].Materials {
			if course.Modules[i].Materials[j].ID.IsZero() {
				course.Modules[i].Materials[j].ID = primitive.NewObjectID()
			}
			course.Modules[i].Materials[j].Order = j
		}
	}

	course.UpdatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"title":         course.Title,
			"description":   course.Description,
			"thumbnail_key": course.ThumbnailKey,
			"modules":       course.Modules,
			"is_published":  course.IsPublished,
			"updated_at":    course.UpdatedAt,
		},
	}

	if _, err := db.Collection("courses").UpdateOne(ctx, bson.M{"_id": id}, update); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update course"})
		return
	}
	c.JSON(http.StatusOK, course)
}

func DeleteCourse(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("courses").DeleteOne(ctx, bson.M{"_id": id}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete course"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "course deleted"})
}
