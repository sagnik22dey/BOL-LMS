package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func CreateGroup(c *gin.Context) {
	orgID, err := primitive.ObjectIDFromHex(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	var req models.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group := models.Group{
		ID:             primitive.NewObjectID(),
		OrganizationID: orgID,
		Name:           req.Name,
		Description:    req.Description,
		CourseIDs:      []primitive.ObjectID{},
		UserIDs:        []primitive.ObjectID{},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("groups").InsertOne(ctx, group); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create group"})
		return
	}
	c.JSON(http.StatusCreated, group)
}

func ListGroups(c *gin.Context) {
	orgID, err := primitive.ObjectIDFromHex(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("groups").Find(ctx, bson.M{"organization_id": orgID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch groups"})
		return
	}
	defer cursor.Close(ctx)

	var groups []models.Group
	if err := cursor.All(ctx, &groups); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode groups"})
		return
	}
	if groups == nil {
		groups = []models.Group{}
	}
	c.JSON(http.StatusOK, groups)
}

func GetGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var group models.Group
	if err := db.Collection("groups").FindOne(ctx, bson.M{"_id": id}).Decode(&group); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}
	c.JSON(http.StatusOK, group)
}

func UpdateGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req models.UpdateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"name":        req.Name,
			"description": req.Description,
			"updated_at":  time.Now(),
		},
	}

	if _, err := db.Collection("groups").UpdateOne(ctx, bson.M{"_id": id}, update); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "group updated"})
}

func DeleteGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("groups").DeleteOne(ctx, bson.M{"_id": id}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "group deleted"})
}

func AddUsersToGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req models.AddUsersToGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var objIDs []primitive.ObjectID
	for _, uid := range req.UserIDs {
		objID, err := primitive.ObjectIDFromHex(uid)
		if err == nil {
			objIDs = append(objIDs, objID)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Collection("groups").UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$addToSet": bson.M{"user_ids": bson.M{"$each": objIDs}},
			"$set":      bson.M{"updated_at": time.Now()},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add users to group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "users added"})
}

func RemoveUserFromGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Collection("groups").UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$pull": bson.M{"user_ids": userID},
			"$set":  bson.M{"updated_at": time.Now()},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove user from group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user removed"})
}

func AssignCoursesToGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req models.AssignCoursesToGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var objIDs []primitive.ObjectID
	for _, cid := range req.CourseIDs {
		objID, err := primitive.ObjectIDFromHex(cid)
		if err == nil {
			objIDs = append(objIDs, objID)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Collection("groups").UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$addToSet": bson.M{"course_ids": bson.M{"$each": objIDs}},
			"$set":      bson.M{"updated_at": time.Now()},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign courses to group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "courses assigned"})
}

func RemoveCourseFromGroup(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	courseID, err := primitive.ObjectIDFromHex(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Collection("groups").UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$pull": bson.M{"course_ids": courseID},
			"$set":  bson.M{"updated_at": time.Now()},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove course from group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "course removed"})
}

// User Course Assignments logic
func AssignCourseToUser(c *gin.Context) {
	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req models.AssignCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignedBy, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var assignments []interface{}
	for _, cidStr := range req.CourseIDs {
		courseID, err := primitive.ObjectIDFromHex(cidStr)
		if err != nil {
			continue // Skip invalid mapping
		}

		// check if already assigned
		var existing models.UserCourseAssignment
		err = db.Collection("user_course_assignments").FindOne(ctx, bson.M{"user_id": userID, "course_id": courseID}).Decode(&existing)
		if err == nil {
			continue // already assigned
		}

		assignments = append(assignments, models.UserCourseAssignment{
			ID:         primitive.NewObjectID(),
			UserID:     userID,
			CourseID:   courseID,
			AssignedBy: assignedBy,
			AssignedAt: time.Now(),
		})
	}

	if len(assignments) > 0 {
		if _, err := db.Collection("user_course_assignments").InsertMany(ctx, assignments); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign courses to user"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "courses assigned successfully"})
}

func RevokeCourseFromUser(c *gin.Context) {
	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	courseID, err := primitive.ObjectIDFromHex(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Collection("user_course_assignments").DeleteMany(ctx, bson.M{
		"user_id":   userID,
		"course_id": courseID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not revoke course"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "course revoked from user"})
}

func GetUserIndividualCourses(c *gin.Context) {
	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("user_course_assignments").Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch user assignments"})
		return
	}
	defer cursor.Close(ctx)

	var assignments []models.UserCourseAssignment
	if err := cursor.All(ctx, &assignments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode user assignments"})
		return
	}

	if assignments == nil {
		assignments = []models.UserCourseAssignment{}
	}

	c.JSON(http.StatusOK, assignments)
}
