package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AssignmentDisplay struct {
	ID        uuid.UUID  `json:"id"`
	Title     string     `json:"title"`
	CourseID  uuid.UUID  `json:"course_id"`
	Deadline  *time.Time `json:"deadline"`
	Progress  int        `json:"progress"`
	Submitted bool       `json:"submitted"`
}

func GetDashboardStats(c *gin.Context) {
	role := c.GetString("role")

	// QUAL-003: Handle parse errors explicitly instead of silently using uuid.Nil.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	// orgID may be empty for super_admin without an org — handle gracefully.
	orgID, _ := uuid.Parse(c.GetString("org_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
		var totalLearners, activeCourses, totalSubmissions, totalAssignments int64

		// PERF: Combine the four scalar counts into a single round trip.
		err := db.Pool.QueryRow(ctx, `
			SELECT
			  (SELECT COUNT(*) FROM users WHERE organization_id=$1 AND role='user'),
			  (SELECT COUNT(*) FROM courses WHERE organization_id=$1),
			  (SELECT COUNT(*) FROM assignments WHERE organization_id=$1),
			  (SELECT COUNT(*) FROM assignment_submissions sub
			     JOIN assignments a ON sub.assignment_id = a.id
			     WHERE a.organization_id = $1)
		`, orgID).Scan(&totalLearners, &activeCourses, &totalAssignments, &totalSubmissions)
		if err != nil {
			// Fall through with zeros — the response still renders safely.
		}

		completionRate := 0
		if totalAssignments > 0 && totalLearners > 0 {
			completionRate = int((float64(totalSubmissions) / float64(totalAssignments*totalLearners)) * 100)
			if completionRate > 100 {
				completionRate = 100
			}
		}

		// PERF: Avoid N+1 by computing per-assignment submission counts in one
		// LEFT JOIN ... GROUP BY query, limited to the most recent assignments
		// (the dashboard only renders the first 5 anyway).
		aRows, _ := db.Pool.Query(ctx, `
			SELECT a.id, a.title, a.course_id, a.deadline,
			       COALESCE(s.cnt, 0) AS subs
			FROM assignments a
			LEFT JOIN (
			  SELECT assignment_id, COUNT(*) AS cnt
			  FROM assignment_submissions
			  GROUP BY assignment_id
			) s ON s.assignment_id = a.id
			WHERE a.organization_id = $1
			ORDER BY a.created_at DESC
			LIMIT 20`, orgID)

		recentAssignments := []AssignmentDisplay{}
		if aRows != nil {
			defer aRows.Close()
			for aRows.Next() {
				var a models.Assignment
				var subs int64
				if aRows.Scan(&a.ID, &a.Title, &a.CourseID, &a.Deadline, &subs) == nil {
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
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"totalLearners":  totalLearners,
			"activeCourses":  activeCourses,
			"completions":    totalSubmissions,
			"completionRate": completionRate,
			"assignments":    recentAssignments,
		})

	} else {
		eRows, _ := db.Pool.Query(ctx,
			`SELECT id, user_id, course_id, progress, created_at, updated_at FROM enrollments WHERE user_id=$1`, userID)

		enrollments := []models.Enrollment{}
		courseIDs := []uuid.UUID{}
		if eRows != nil {
			defer eRows.Close()
			for eRows.Next() {
				var e models.Enrollment
				if eRows.Scan(&e.ID, &e.UserID, &e.CourseID, &e.Progress, &e.CreatedAt, &e.UpdatedAt) == nil {
					enrollments = append(enrollments, e)
					courseIDs = append(courseIDs, e.CourseID)
				}
			}
		}

		enrollCount := len(enrollments)
		completedCount := 0
		var totalProgress float64
		for _, e := range enrollments {
			totalProgress += e.Progress
			if e.Progress >= 100 {
				completedCount++
			}
		}
		avgProgress := 0
		if enrollCount > 0 {
			avgProgress = int(totalProgress / float64(enrollCount))
		}

		recentAssignments := []AssignmentDisplay{}
		if len(courseIDs) > 0 {
			// PERF: Single LEFT JOIN to fetch each assignment + this user's
			// submission flag in one round trip (was 1 + N queries).
			assnRows, _ := db.Pool.Query(ctx, `
				SELECT a.id, a.title, a.course_id, a.deadline,
				       (sub.id IS NOT NULL) AS submitted
				FROM assignments a
				LEFT JOIN assignment_submissions sub
				  ON sub.assignment_id = a.id AND sub.user_id = $2
				WHERE a.course_id = ANY($1)
				ORDER BY a.created_at DESC
				LIMIT 20`, courseIDs, userID)
			if assnRows != nil {
				defer assnRows.Close()
				for assnRows.Next() {
					var a models.Assignment
					var submitted bool
					if assnRows.Scan(&a.ID, &a.Title, &a.CourseID, &a.Deadline, &submitted) == nil {
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
