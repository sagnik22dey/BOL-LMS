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

type CourseAssignmentSummary struct {
	CourseID    uuid.UUID `json:"course_id"`
	CourseTitle string    `json:"course_title"`
	AssignedAt  time.Time `json:"assigned_at"`
	Progress    float64   `json:"progress"`
	IsEnrolled  bool      `json:"is_enrolled"`
	Source      string    `json:"source"` // "assignment" or "enrollment"
}

type AnalyticsUserWithCourses struct {
	models.User
	AssignedCourses []CourseAssignmentSummary `json:"assigned_courses"`
}

type AnalyticsOrganization struct {
	ID        uuid.UUID                  `json:"id"`
	Name      string                     `json:"name"`
	Slug      string                     `json:"slug"`
	CreatedAt time.Time                  `json:"created_at"`
	Admins    []models.User              `json:"admins"`
	Users     []AnalyticsUserWithCourses `json:"users"`
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

	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM organizations`).Scan(&response.TotalOrganizations)
	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='admin'`).Scan(&response.TotalAdmins)
	db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='user'`).Scan(&response.TotalUsers)

	orgRows, err := db.Pool.Query(ctx, `SELECT id, name, slug, created_at FROM organizations`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch organizations"})
		return
	}
	defer orgRows.Close()

	type orgRow struct {
		id        uuid.UUID
		name      string
		slug      string
		createdAt time.Time
	}
	var orgs []orgRow
	for orgRows.Next() {
		var o orgRow
		if orgRows.Scan(&o.id, &o.name, &o.slug, &o.createdAt) == nil {
			orgs = append(orgs, o)
		}
	}

	userRows, err := db.Pool.Query(ctx,
		`SELECT id, name, email, password_hash, role, organization_id, is_suspended, created_at, updated_at
		 FROM users WHERE role IN ('admin', 'user')`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch users"})
		return
	}
	defer userRows.Close()

	adminMap := make(map[uuid.UUID][]models.User)
	userMap := make(map[uuid.UUID][]AnalyticsUserWithCourses)
	// index: userID -> (orgID, slice index) for quick lookups
	userIndex := make(map[uuid.UUID]struct {
		orgID uuid.UUID
		idx   int
	})

	for userRows.Next() {
		u, err := scanUser(userRows)
		if err != nil || u.OrganizationID == nil {
			continue
		}
		if u.Role == models.RoleAdmin {
			adminMap[*u.OrganizationID] = append(adminMap[*u.OrganizationID], u)
		} else {
			idx := len(userMap[*u.OrganizationID])
			userMap[*u.OrganizationID] = append(userMap[*u.OrganizationID], AnalyticsUserWithCourses{
				User:            u,
				AssignedCourses: []CourseAssignmentSummary{},
			})
			userIndex[u.ID] = struct {
				orgID uuid.UUID
				idx   int
			}{orgID: *u.OrganizationID, idx: idx}
		}
	}

	// Collect all regular user IDs for batch queries
	allUserIDs := make([]uuid.UUID, 0, len(userIndex))
	for uid := range userIndex {
		allUserIDs = append(allUserIDs, uid)
	}

	if len(allUserIDs) > 0 {
		// Tracks (userID:courseID) pairs already added to prevent duplicates
		seenPairs := make(map[string]bool)

		// 1. Fetch admin-assigned courses (user_course_assignments)
		assignRows, err := db.Pool.Query(ctx, `
			SELECT uca.user_id, uca.course_id, c.title, uca.assigned_at,
			       COALESCE(e.progress, 0) AS progress,
			       (e.id IS NOT NULL) AS is_enrolled
			FROM user_course_assignments uca
			JOIN courses c ON c.id = uca.course_id
			LEFT JOIN enrollments e ON e.user_id = uca.user_id AND e.course_id = uca.course_id
			WHERE uca.user_id = ANY($1)`, allUserIDs)
		if err == nil {
			defer assignRows.Close()
			for assignRows.Next() {
				var userID, courseID uuid.UUID
				var title string
				var assignedAt time.Time
				var progress float64
				var isEnrolled bool
				if err := assignRows.Scan(&userID, &courseID, &title, &assignedAt, &progress, &isEnrolled); err != nil {
					continue
				}
				key := userID.String() + ":" + courseID.String()
				if seenPairs[key] {
					continue
				}
				seenPairs[key] = true
				info := userIndex[userID]
				userMap[info.orgID][info.idx].AssignedCourses = append(
					userMap[info.orgID][info.idx].AssignedCourses,
					CourseAssignmentSummary{
						CourseID:    courseID,
						CourseTitle: title,
						AssignedAt:  assignedAt,
						Progress:    progress,
						IsEnrolled:  isEnrolled,
						Source:      "assignment",
					},
				)
			}
		}

		// 2. Fetch direct enrollments (e.g. free courses enrolled without admin assignment)
		enrollRows, err := db.Pool.Query(ctx, `
			SELECT e.user_id, e.course_id, c.title, e.created_at, e.progress
			FROM enrollments e
			JOIN courses c ON c.id = e.course_id
			WHERE e.user_id = ANY($1)`, allUserIDs)
		if err == nil {
			defer enrollRows.Close()
			for enrollRows.Next() {
				var userID, courseID uuid.UUID
				var title string
				var enrolledAt time.Time
				var progress float64
				if err := enrollRows.Scan(&userID, &courseID, &title, &enrolledAt, &progress); err != nil {
					continue
				}
				key := userID.String() + ":" + courseID.String()
				if seenPairs[key] {
					// Already listed via assignment — skip to avoid duplicate
					continue
				}
				seenPairs[key] = true
				info, ok := userIndex[userID]
				if !ok {
					continue
				}
				userMap[info.orgID][info.idx].AssignedCourses = append(
					userMap[info.orgID][info.idx].AssignedCourses,
					CourseAssignmentSummary{
						CourseID:    courseID,
						CourseTitle: title,
						AssignedAt:  enrolledAt,
						Progress:    progress,
						IsEnrolled:  true,
						Source:      "enrollment",
					},
				)
			}
		}
	}

	response.Organizations = []AnalyticsOrganization{}
	for _, o := range orgs {
		admins := adminMap[o.id]
		if admins == nil {
			admins = []models.User{}
		}
		users := userMap[o.id]
		if users == nil {
			users = []AnalyticsUserWithCourses{}
		}
		response.Organizations = append(response.Organizations, AnalyticsOrganization{
			ID:        o.id,
			Name:      o.name,
			Slug:      o.slug,
			CreatedAt: o.createdAt,
			Admins:    admins,
			Users:     users,
		})
	}

	c.JSON(http.StatusOK, response)
}
