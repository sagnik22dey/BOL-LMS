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

type AssignmentDisplay struct {
	ID        primitive.ObjectID `json:"id"`
	Title     string             `json:"title"`
	CourseID  primitive.ObjectID `json:"course_id"`
	Deadline  *time.Time         `json:"deadline"`
	Progress  int                `json:"progress"`
	Submitted bool               `json:"submitted"` // for user
}

func GetDashboardStats(c *gin.Context) {
	orgID, _ := primitive.ObjectIDFromHex(c.GetString("org_id"))
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
	role := c.GetString("role")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
		// Admin Stats
		totalLearners, _ := db.Collection("users").CountDocuments(ctx, bson.M{"organization_id": orgID, "role": "user"})
		activeCourses, _ := db.Collection("courses").CountDocuments(ctx, bson.M{"organization_id": orgID})
		
		totalAssignments, _ := db.Collection("assignments").CountDocuments(ctx, bson.M{"organization_id": orgID})
		totalSubmissions, _ := db.Collection("assignment_submissions").CountDocuments(ctx, bson.M{"assignment_id": bson.M{"$exists": true}})

		completionRate := 0
		if totalAssignments > 0 && totalLearners > 0 {
			completionRate = int((float64(totalSubmissions) / float64(totalAssignments*totalLearners)) * 100)
			if completionRate > 100 {
				completionRate = 100
			}
		}

		// Get recent assignments
		var assignments []models.Assignment
		cur, _ := db.Collection("assignments").Find(ctx, bson.M{"organization_id": orgID})
		cur.All(ctx, &assignments)

		var recentAssignments []AssignmentDisplay
		for _, a := range assignments {
			subs, _ := db.Collection("assignment_submissions").CountDocuments(ctx, bson.M{"assignment_id": a.ID})
			prog := 0
			if totalLearners > 0 {
				prog = int((float64(subs) / float64(totalLearners)) * 100)
			}
			recentAssignments = append(recentAssignments, AssignmentDisplay{
				ID:       a.ID,
				Title:    a.Title,
				CourseID: a.CourseID,
				Deadline: a.Deadline,
				Progress: prog,
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"totalLearners":  totalLearners,
			"activeCourses":  activeCourses,
			"completions":    totalSubmissions,
			"completionRate": completionRate,
			"assignments":    recentAssignments,
		})
	} else {
		// Student Stats
		var enrollments []models.Enrollment
		cur, _ := db.Collection("enrollments").Find(ctx, bson.M{"user_id": userID})
		cur.All(ctx, &enrollments)

		enrollCount := len(enrollments)
		completedCount := 0
		var totalProgress float64 = 0

		var courseIDs []primitive.ObjectID
		for _, e := range enrollments {
			courseIDs = append(courseIDs, e.CourseID)
			totalProgress += e.Progress
			if e.Progress >= 100 {
				completedCount++
			}
		}

		avgProgress := 0
		if enrollCount > 0 {
			avgProgress = int(totalProgress / float64(enrollCount))
		}

		var recentAssignments []AssignmentDisplay
		if len(courseIDs) > 0 {
			var assignments []models.Assignment
			curAssn, _ := db.Collection("assignments").Find(ctx, bson.M{"course_id": bson.M{"$in": courseIDs}})
			curAssn.All(ctx, &assignments)

			for _, a := range assignments {
				count, _ := db.Collection("assignment_submissions").CountDocuments(ctx, bson.M{"assignment_id": a.ID, "user_id": userID})
				submitted := count > 0
				prog := 0
				if submitted {
					prog = 100
				}
				recentAssignments = append(recentAssignments, AssignmentDisplay{
					ID:        a.ID,
					Title:     a.Title,
					CourseID:  a.CourseID,
					Deadline:  a.Deadline,
					Progress:  prog,
					Submitted: submitted,
				})
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"enrolledCourses": enrollCount,
			"completed":       completedCount,
			"avgProgress":     avgProgress,
			"assignments":     recentAssignments,
		})
	}
}
