package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MarkMaterialComplete marks a single material as completed for the calling user.
// It then recomputes + persists the course progress on the enrollment row.
// POST /api/learning/complete
func MarkMaterialComplete(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	var req models.MarkCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}
	moduleID, err := uuid.Parse(req.ModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module_id"})
		return
	}
	materialID, err := uuid.Parse(req.MaterialID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid material_id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Upsert completion record
	var compID uuid.UUID
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO material_completions (id, user_id, course_id, module_id, material_id, completed_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id, material_id) DO UPDATE SET completed_at = NOW()
		RETURNING id`,
		uuid.New(), userID, courseID, moduleID, materialID,
	).Scan(&compID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark material complete"})
		return
	}

	// Recompute + sync progress
	progress, _ := recomputeAndSyncProgress(ctx, userID, courseID)
	c.JSON(http.StatusOK, gin.H{"message": "marked complete", "progress_pct": progress})
}

// UnmarkMaterialComplete removes the completion record for a material.
// DELETE /api/learning/complete
func UnmarkMaterialComplete(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	var req models.MarkCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	materialID, err := uuid.Parse(req.MaterialID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid material_id"})
		return
	}
	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`DELETE FROM material_completions WHERE user_id=$1 AND material_id=$2`,
		userID, materialID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not unmark material"})
		return
	}

	progress, _ := recomputeAndSyncProgress(ctx, userID, courseID)
	c.JSON(http.StatusOK, gin.H{"message": "unmarked", "progress_pct": progress})
}

// GetCourseProgress returns completion data for a specific course for the calling user.
// GET /api/learning/courses/:courseId/progress
func GetCourseProgress(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	courseID, err := uuid.Parse(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx,
		`SELECT id, user_id, course_id, module_id, material_id, completed_at
		 FROM material_completions
		 WHERE user_id=$1 AND course_id=$2`,
		userID, courseID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch completions"})
		return
	}
	defer rows.Close()

	completions := []models.MaterialCompletion{}
	for rows.Next() {
		var mc models.MaterialCompletion
		if err := rows.Scan(&mc.ID, &mc.UserID, &mc.CourseID, &mc.ModuleID, &mc.MaterialID, &mc.CompletedAt); err == nil {
			completions = append(completions, mc)
		}
	}

	total, _ := countCourseMaterials(ctx, courseID)
	completed := len(completions)
	var pct float64
	if total > 0 {
		pct = float64(completed) / float64(total) * 100
	}

	c.JSON(http.StatusOK, models.CourseProgressResponse{
		CourseID:           courseID,
		TotalMaterials:     total,
		CompletedMaterials: completed,
		ProgressPct:        pct,
		Completions:        completions,
	})
}

// GetMyLearningGoals returns the learning goals assigned to the calling user,
// enriched with course title and current progress.
// GET /api/learning/goals
func GetMyLearningGoals(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT lg.id, lg.user_id, lg.course_id, lg.assigned_by, lg.target_date, lg.created_at,
		       c.title
		FROM learning_goals lg
		JOIN courses c ON c.id = lg.course_id
		WHERE lg.user_id = $1
		ORDER BY lg.created_at DESC`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch learning goals"})
		return
	}
	defer rows.Close()

	goals := []models.LearningGoal{}
	for rows.Next() {
		var g models.LearningGoal
		if err := rows.Scan(&g.ID, &g.UserID, &g.CourseID, &g.AssignedBy, &g.TargetDate, &g.CreatedAt, &g.CourseTitle); err == nil {
			goals = append(goals, g)
		}
	}

	// Enrich each goal with current progress
	for i, g := range goals {
		total, _ := countCourseMaterials(ctx, g.CourseID)
		var completed int
		db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM material_completions WHERE user_id=$1 AND course_id=$2`,
			userID, g.CourseID,
		).Scan(&completed)

		if total > 0 {
			goals[i].ProgressPct = float64(completed) / float64(total) * 100
		}
	}

	c.JSON(http.StatusOK, gin.H{"goals": goals})
}

// AssignLearningGoal lets an admin assign a learning goal (course target) to a user.
// POST /api/admin/learning-goals
func AssignLearningGoal(c *gin.Context) {
	adminID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	var req models.AssignLearningGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	var targetDate *time.Time
	if req.TargetDate != nil && *req.TargetDate != "" {
		t, err := time.Parse(time.RFC3339, *req.TargetDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid target_date; use RFC3339 format"})
			return
		}
		targetDate = &t
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var goalID uuid.UUID
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO learning_goals (id, user_id, course_id, assigned_by, target_date)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, course_id) DO UPDATE SET target_date = EXCLUDED.target_date, assigned_by = EXCLUDED.assigned_by
		RETURNING id`,
		uuid.New(), userID, courseID, adminID, targetDate,
	).Scan(&goalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign learning goal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": goalID, "message": "learning goal assigned"})
}

// DeleteLearningGoal removes a learning goal.
// DELETE /api/admin/learning-goals/:goalId
func DeleteLearningGoal(c *gin.Context) {
	goalID, err := uuid.Parse(c.Param("goalId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tag, err := db.Pool.Exec(ctx, `DELETE FROM learning_goals WHERE id=$1`, goalID)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "goal not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "learning goal removed"})
}

// ── internal helpers ──────────────────────────────────────────────────────────

// modMaterialStub is used only for counting materials in a course's JSONB modules column.
type modMaterialStub struct {
	Materials []struct{} `json:"materials"`
}

// countCourseMaterials counts total materials across all modules of a course by
// reading the modules JSONB column.
func countCourseMaterials(ctx context.Context, courseID uuid.UUID) (int, error) {
	var modulesJSON []byte
	err := db.Pool.QueryRow(ctx, `SELECT modules FROM courses WHERE id=$1`, courseID).Scan(&modulesJSON)
	if err != nil {
		return 0, err
	}

	var mods []modMaterialStub
	if parseErr := json.Unmarshal(modulesJSON, &mods); parseErr != nil {
		return 0, parseErr
	}

	total := 0
	for _, m := range mods {
		total += len(m.Materials)
	}
	return total, nil
}

// recomputeAndSyncProgress recalculates completion percentage and updates the
// enrollment row so the existing progress field stays in sync.
func recomputeAndSyncProgress(ctx context.Context, userID, courseID uuid.UUID) (float64, error) {
	total, err := countCourseMaterials(ctx, courseID)
	if err != nil || total == 0 {
		return 0, err
	}

	var completed int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM material_completions WHERE user_id=$1 AND course_id=$2`,
		userID, courseID,
	).Scan(&completed)

	pct := float64(completed) / float64(total) * 100

	// Persist back to enrollment.progress (stored as 0-100)
	db.Pool.Exec(ctx,
		`UPDATE enrollments SET progress=$1, updated_at=NOW() WHERE user_id=$2 AND course_id=$3`,
		pct, userID, courseID,
	)

	return pct, nil
}
