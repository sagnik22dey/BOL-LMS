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

func scanGroup(row interface{ Scan(...any) error }) (models.Group, error) {
	var g models.Group
	err := row.Scan(&g.ID, &g.OrganizationID, &g.Name, &g.Description, &g.CreatedAt, &g.UpdatedAt)
	return g, err
}

func loadGroupRelations(ctx context.Context, g *models.Group) {
	courseRows, _ := db.Pool.Query(ctx, `SELECT course_id FROM group_courses WHERE group_id=$1`, g.ID)
	if courseRows != nil {
		defer courseRows.Close()
		for courseRows.Next() {
			var cid uuid.UUID
			if courseRows.Scan(&cid) == nil {
				g.CourseIDs = append(g.CourseIDs, cid)
			}
		}
	}
	if g.CourseIDs == nil {
		g.CourseIDs = []uuid.UUID{}
	}

	userRows, _ := db.Pool.Query(ctx, `SELECT user_id FROM group_users WHERE group_id=$1`, g.ID)
	if userRows != nil {
		defer userRows.Close()
		for userRows.Next() {
			var uid uuid.UUID
			if userRows.Scan(&uid) == nil {
				g.UserIDs = append(g.UserIDs, uid)
			}
		}
	}
	if g.UserIDs == nil {
		g.UserIDs = []uuid.UUID{}
	}
}

func CreateGroup(c *gin.Context) {
	orgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	var req models.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	group := models.Group{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Name:           req.Name,
		Description:    req.Description,
		CourseIDs:      []uuid.UUID{},
		UserIDs:        []uuid.UUID{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO groups (id, organization_id, name, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		group.ID, group.OrganizationID, group.Name, group.Description, group.CreatedAt, group.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create group"})
		return
	}
	c.JSON(http.StatusCreated, group)
}

func ListGroups(c *gin.Context) {
	orgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, organization_id, name, description, created_at, updated_at
		 FROM groups WHERE organization_id=$1`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch groups"})
		return
	}
	defer rows.Close()

	groups := []models.Group{}
	for rows.Next() {
		g, err := scanGroup(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode groups"})
			return
		}
		loadGroupRelations(ctx, &g)
		groups = append(groups, g)
	}
	c.JSON(http.StatusOK, groups)
}

func GetGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	row := db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, name, description, created_at, updated_at
		 FROM groups WHERE id=$1`, id)
	group, err := scanGroup(row)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}
	loadGroupRelations(ctx, &group)
	c.JSON(http.StatusOK, group)
}

func UpdateGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
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

	_, err = db.Pool.Exec(ctx,
		`UPDATE groups SET name=$1, description=$2, updated_at=$3 WHERE id=$4`,
		req.Name, req.Description, time.Now(), id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "group updated"})
}

func DeleteGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Pool.Exec(ctx, `DELETE FROM groups WHERE id=$1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "group deleted"})
}

func AddUsersToGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req models.AddUsersToGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, uid := range req.UserIDs {
		userID, err := uuid.Parse(uid)
		if err != nil {
			continue
		}
		db.Pool.Exec(ctx,
			`INSERT INTO group_users (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			id, userID)
	}

	db.Pool.Exec(ctx, `UPDATE groups SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "users added"})
}

func RemoveUserFromGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db.Pool.Exec(ctx, `DELETE FROM group_users WHERE group_id=$1 AND user_id=$2`, id, userID)
	db.Pool.Exec(ctx, `UPDATE groups SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "user removed"})
}

func AssignCoursesToGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req models.AssignCoursesToGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, cid := range req.CourseIDs {
		courseID, err := uuid.Parse(cid)
		if err != nil {
			continue
		}
		db.Pool.Exec(ctx,
			`INSERT INTO group_courses (group_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			id, courseID)
	}

	db.Pool.Exec(ctx, `UPDATE groups SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "courses assigned"})
}

func RemoveCourseFromGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	courseID, err := uuid.Parse(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db.Pool.Exec(ctx, `DELETE FROM group_courses WHERE group_id=$1 AND course_id=$2`, id, courseID)
	db.Pool.Exec(ctx, `UPDATE groups SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "course removed"})
}

func AssignCourseToUser(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req models.AssignCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignedBy, _ := uuid.Parse(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, cidStr := range req.CourseIDs {
		courseID, err := uuid.Parse(cidStr)
		if err != nil {
			continue
		}
		db.Pool.Exec(ctx,
			`INSERT INTO user_course_assignments (id, user_id, course_id, assigned_by, assigned_at)
			 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, course_id) DO NOTHING`,
			uuid.New(), userID, courseID, assignedBy, time.Now(),
		)
	}

	c.JSON(http.StatusOK, gin.H{"message": "courses assigned successfully"})
}

func RevokeCourseFromUser(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	courseID, err := uuid.Parse(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`DELETE FROM user_course_assignments WHERE user_id=$1 AND course_id=$2`, userID, courseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not revoke course"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "course revoked from user"})
}

func GetUserIndividualCourses(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, user_id, course_id, assigned_by, assigned_at
		 FROM user_course_assignments WHERE user_id=$1`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch user assignments"})
		return
	}
	defer rows.Close()

	assignments := []models.UserCourseAssignment{}
	for rows.Next() {
		var a models.UserCourseAssignment
		if err := rows.Scan(&a.ID, &a.UserID, &a.CourseID, &a.AssignedBy, &a.AssignedAt); err == nil {
			assignments = append(assignments, a)
		}
	}
	c.JSON(http.StatusOK, assignments)
}
