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

	orgID, err := primitive.ObjectIDFromHex(req.OrganizationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	user := models.User{
		ID:             primitive.NewObjectID(),
		Name:           req.Name,
		Email:          req.Email,
		PasswordHash:   string(hash),
		Role:           models.RoleAdmin,
		OrganizationID: &orgID,
		IsSuspended:    false,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	col := db.Collection("users")
	var existing models.User
	if err := col.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existing); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	if _, err := col.InsertOne(ctx, user); err != nil {
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

	orgID, err := primitive.ObjectIDFromHex(orgIDStr)
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

	user := models.User{
		ID:             primitive.NewObjectID(),
		Name:           req.Name,
		Email:          req.Email,
		PasswordHash:   string(hash),
		Role:           models.RoleUser,
		OrganizationID: &orgID,
		IsSuspended:    false,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	col := db.Collection("users")
	var existing models.User
	if err := col.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existing); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	if _, err := col.InsertOne(ctx, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create user"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func GetOrganizationUsers(c *gin.Context) {
	orgIDStr := c.GetString("org_id")
	if orgIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "admin not associated with an organization"})
		return
	}

	orgID, err := primitive.ObjectIDFromHex(orgIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid admin organization"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("users").Find(ctx, bson.M{"organization_id": orgID, "role": models.RoleUser})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch organization users"})
		return
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
		return
	}

	if users == nil {
		users = []models.User{}
	}

	c.JSON(http.StatusOK, users)
}

func GetSuperAdminsUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("users").Find(ctx, bson.M{"role": bson.M{"$in": []models.Role{models.RoleAdmin, models.RoleUser}}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch users"})
		return
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
		return
	}

	if users == nil {
		users = []models.User{}
	}

	c.JSON(http.StatusOK, users)
}

func GetUnassignedUsers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find users that are not superadmins and don't have an organization
	filter := bson.M{
		"role": bson.M{"$ne": models.RoleSuperAdmin},
		"$or": []bson.M{
			{"organization_id": nil},
			{"organization_id": bson.M{"$exists": false}},
		},
	}

	cursor, err := db.Collection("users").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch unassigned users"})
		return
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
		return
	}

	if users == nil {
		users = []models.User{}
	}

	c.JSON(http.StatusOK, users)
}

func DeleteUser(c *gin.Context) {
	paramID := c.Param("id")
	id, err := primitive.ObjectIDFromHex(paramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id: " + paramID})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Get user to be deleted for org check
	var userToDel models.User
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": id}).Decode(&userToDel); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// 2. Permission check
	callerRole := c.GetString("role")
	callerOrgID := c.GetString("org_id")

	if callerRole != string(models.RoleSuperAdmin) {
		// Admin can only delete users in their own organization
		if userToDel.OrganizationID == nil || userToDel.OrganizationID.Hex() != callerOrgID {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only delete users in your own organization"})
			return
		}
	}

	// 3. Delete
	_, err = db.Collection("users").DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error during deletion"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

func SuspendUser(c *gin.Context) {
	paramID := c.Param("id")
	id, err := primitive.ObjectIDFromHex(paramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id: " + paramID})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var userToToggle models.User
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": id}).Decode(&userToToggle); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Permission check
	callerRole := c.GetString("role")
	callerOrgID := c.GetString("org_id")

	if callerRole != string(models.RoleSuperAdmin) {
		if userToToggle.OrganizationID == nil || userToToggle.OrganizationID.Hex() != callerOrgID {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only manage users in your own organization"})
			return
		}
	}

	update := bson.M{"$set": bson.M{"is_suspended": !userToToggle.IsSuspended, "updated_at": time.Now()}}
	_, err = db.Collection("users").UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error during update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user status updated"})
}
