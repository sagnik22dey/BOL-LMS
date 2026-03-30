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

func scanCourseBundle(row interface{ Scan(...any) error }) (models.CourseBundle, error) {
	var cb models.CourseBundle
	err := row.Scan(&cb.ID, &cb.OrganizationID, &cb.Name, &cb.Description, &cb.Price, &cb.Currency, &cb.ValidityDays, &cb.CreatedAt, &cb.UpdatedAt)
	return cb, err
}

func loadCourseBundleRelations(ctx context.Context, cb *models.CourseBundle) {
	courseRows, _ := db.Pool.Query(ctx, `SELECT course_id FROM course_bundle_courses WHERE bundle_id=$1`, cb.ID)
	if courseRows != nil {
		defer courseRows.Close()
		for courseRows.Next() {
			var cid uuid.UUID
			if courseRows.Scan(&cid) == nil {
				cb.CourseIDs = append(cb.CourseIDs, cid)
			}
		}
	}
	if cb.CourseIDs == nil {
		cb.CourseIDs = []uuid.UUID{}
	}

	userRows, _ := db.Pool.Query(ctx, `SELECT user_id FROM course_bundle_users WHERE bundle_id=$1`, cb.ID)
	if userRows != nil {
		defer userRows.Close()
		for userRows.Next() {
			var uid uuid.UUID
			if userRows.Scan(&uid) == nil {
				cb.UserIDs = append(cb.UserIDs, uid)
			}
		}
	}
	if cb.UserIDs == nil {
		cb.UserIDs = []uuid.UUID{}
	}
}

func CreateCourseBundle(c *gin.Context) {
	orgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	var req models.CreateCourseBundleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	now := time.Now()
	bundle := models.CourseBundle{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Name:           req.Name,
		Description:    req.Description,
		Price:          req.Price,
		Currency:       currency,
		ValidityDays:   req.ValidityDays,
		CourseIDs:      []uuid.UUID{},
		UserIDs:        []uuid.UUID{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO course_bundles (id, organization_id, name, description, price, currency, validity_days, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		bundle.ID, bundle.OrganizationID, bundle.Name, bundle.Description, bundle.Price, bundle.Currency, bundle.ValidityDays, bundle.CreatedAt, bundle.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create course bundle"})
		return
	}
	c.JSON(http.StatusCreated, bundle)
}

func ListCourseBundles(c *gin.Context) {
	orgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, organization_id, name, description, price, currency, validity_days, created_at, updated_at
		 FROM course_bundles WHERE organization_id=$1`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch course bundles"})
		return
	}
	defer rows.Close()

	bundles := []models.CourseBundle{}
	for rows.Next() {
		cb, err := scanCourseBundle(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decode course bundles"})
			return
		}
		loadCourseBundleRelations(ctx, &cb)
		bundles = append(bundles, cb)
	}
	c.JSON(http.StatusOK, bundles)
}

func GetCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	row := db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, name, description, price, currency, validity_days, created_at, updated_at
		 FROM course_bundles WHERE id=$1`, id)
	bundle, err := scanCourseBundle(row)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course bundle not found"})
		return
	}
	loadCourseBundleRelations(ctx, &bundle)
	c.JSON(http.StatusOK, bundle)
}

func UpdateCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}

	var req models.UpdateCourseBundleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	_, err = db.Pool.Exec(ctx,
		`UPDATE course_bundles SET name=$1, description=$2, price=$3, currency=$4, validity_days=$5, updated_at=$6 WHERE id=$7`,
		req.Name, req.Description, req.Price, currency, req.ValidityDays, time.Now(), id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update course bundle"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "course bundle updated"})
}

func DeleteCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Pool.Exec(ctx, `DELETE FROM course_bundles WHERE id=$1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete course bundle"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "course bundle deleted"})
}

func AddUsersToCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}

	var req models.AddUsersToCourseBundleRequest
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
			`INSERT INTO course_bundle_users (bundle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			id, userID)
	}

	db.Pool.Exec(ctx, `UPDATE course_bundles SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "users added"})
}

func RemoveUserFromCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db.Pool.Exec(ctx, `DELETE FROM course_bundle_users WHERE bundle_id=$1 AND user_id=$2`, id, userID)
	db.Pool.Exec(ctx, `UPDATE course_bundles SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "user removed"})
}

func AssignCoursesToCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}

	var req models.AssignCoursesToCourseBundleRequest
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
			`INSERT INTO course_bundle_courses (bundle_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			id, courseID)
	}

	db.Pool.Exec(ctx, `UPDATE course_bundles SET updated_at=$1 WHERE id=$2`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "courses assigned"})
}

func RemoveCourseFromCourseBundle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course bundle id"})
		return
	}
	courseID, err := uuid.Parse(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db.Pool.Exec(ctx, `DELETE FROM course_bundle_courses WHERE bundle_id=$1 AND course_id=$2`, id, courseID)
	db.Pool.Exec(ctx, `UPDATE course_bundles SET updated_at=$1 WHERE id=$2`, time.Now(), id)
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
