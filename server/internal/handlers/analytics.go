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

type AnalyticsOrganization struct {
	ID        primitive.ObjectID `json:"id"`
	Name      string             `json:"name"`
	Slug      string             `json:"slug"`
	CreatedAt time.Time          `json:"created_at"`
	Admins    []models.User      `json:"admins"`
	Users     []models.User      `json:"users"`
}

type SuperAdminAnalyticsResponse struct {
	TotalOrganizations int64                   `json:"total_organizations"`
	TotalAdmins        int64                   `json:"total_admins"`
	TotalUsers         int64                   `json:"total_users"`
	Organizations      []AnalyticsOrganization `json:"organizations"`
}

func GetSuperAdminAnalytics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var response SuperAdminAnalyticsResponse

	// Get totals
	orgsCount, err := db.Collection("organizations").CountDocuments(ctx, bson.M{})
	if err == nil {
		response.TotalOrganizations = orgsCount
	}

	adminsCount, err := db.Collection("users").CountDocuments(ctx, bson.M{"role": models.RoleAdmin})
	if err == nil {
		response.TotalAdmins = adminsCount
	}

	usersCount, err := db.Collection("users").CountDocuments(ctx, bson.M{"role": models.RoleUser})
	if err == nil {
		response.TotalUsers = usersCount
	}

	// Fetch organizations
	orgCursor, err := db.Collection("organizations").Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch organizations"})
		return
	}
	defer orgCursor.Close(ctx)

	var orgs []models.Organization
	if err := orgCursor.All(ctx, &orgs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode organizations"})
		return
	}

	// Fetch all admins and users to map them to organizations efficiently
	userCursor, err := db.Collection("users").Find(ctx, bson.M{"role": bson.M{"$in": []models.Role{models.RoleAdmin, models.RoleUser}}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch users"})
		return
	}
	defer userCursor.Close(ctx)

	var allUsers []models.User
	if err := userCursor.All(ctx, &allUsers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode users"})
		return
	}

	// Group users by organization id
	adminMap := make(map[string][]models.User)
	userMap := make(map[string][]models.User)

	for _, u := range allUsers {
		if u.OrganizationID != nil {
			orgIDStr := u.OrganizationID.Hex()
			if u.Role == models.RoleAdmin {
				adminMap[orgIDStr] = append(adminMap[orgIDStr], u)
			} else if u.Role == models.RoleUser {
				userMap[orgIDStr] = append(userMap[orgIDStr], u)
			}
		}
	}

	// Build the final array
	for _, o := range orgs {
		orgIDStr := o.ID.Hex()
		
		analyticOrg := AnalyticsOrganization{
			ID:        o.ID,
			Name:      o.Name,
			Slug:      o.Slug,
			CreatedAt: o.CreatedAt,
			Admins:    adminMap[orgIDStr],
			Users:     userMap[orgIDStr],
		}

		if analyticOrg.Admins == nil {
			analyticOrg.Admins = []models.User{}
		}
		if analyticOrg.Users == nil {
			analyticOrg.Users = []models.User{}
		}

		response.Organizations = append(response.Organizations, analyticOrg)
	}

	if response.Organizations == nil {
		response.Organizations = []AnalyticsOrganization{}
	}

	c.JSON(http.StatusOK, response)
}
