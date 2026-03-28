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

func CreateOrganization(c *gin.Context) {
	var req models.CreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	org := models.Organization{
		ID:        primitive.NewObjectID(),
		Name:      req.Name,
		Slug:      req.Slug,
		AdminIDs:  []primitive.ObjectID{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	col := db.Collection("organizations")
	var existing models.Organization
	if err := col.FindOne(ctx, bson.M{"slug": req.Slug}).Decode(&existing); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "slug already taken"})
		return
	}

	if _, err := col.InsertOne(ctx, org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create organization"})
		return
	}
	c.JSON(http.StatusCreated, org)
}

func ListOrganizations(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("organizations").Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list organizations"})
		return
	}
	defer cursor.Close(ctx)

	var orgs []models.Organization
	if err := cursor.All(ctx, &orgs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode organizations"})
		return
	}
	c.JSON(http.StatusOK, orgs)
}

func UpdateOrganization(c *gin.Context) {
	orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
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

	col := db.Collection("organizations")
	
	// Check if another organization already uses this slug
	var existing models.Organization
	err = col.FindOne(ctx, bson.M{"slug": req.Slug, "_id": bson.M{"$ne": orgID}}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "slug already taken by another organization"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"name":       req.Name,
			"slug":       req.Slug,
			"updated_at": time.Now(),
		},
	}

	result, err := col.UpdateOne(ctx, bson.M{"_id": orgID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update organization"})
		return
	}

	if result.ModifiedCount == 0 && result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "organization updated successfully"})
}

func AssignUserToOrg(c *gin.Context) {
	orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	var req models.AssignUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := primitive.ObjectIDFromHex(req.UserID)
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

	// Only add to admin_ids if the role is admin
	if req.Role == models.RoleAdmin {
		_, err = db.Collection("organizations").UpdateOne(ctx,
			bson.M{"_id": orgID},
			bson.M{"$addToSet": bson.M{"admin_ids": userID}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign admin to organization"})
			return
		}
	} else {
		// Remove from admin_ids if switching from admin to user
		_, err = db.Collection("organizations").UpdateOne(ctx,
			bson.M{"_id": orgID},
			bson.M{"$pull": bson.M{"admin_ids": userID}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update organization admins list"})
			return
		}
	}

	_, err = db.Collection("users").UpdateOne(ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{
			"role":            req.Role,
			"organization_id": orgID,
			"updated_at":      time.Now(),
		}},
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

	orgID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	if err := db.Collection("organizations").FindOne(ctx, bson.M{"_id": orgID}).Decode(&org); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	c.JSON(http.StatusOK, org)
}
