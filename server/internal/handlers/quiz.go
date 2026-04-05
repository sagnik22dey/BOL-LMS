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

func scanSubmission(row interface{ Scan(...any) error }) (models.Submission, error) {
	var s models.Submission
	var rawAnswers []byte
	err := row.Scan(&s.ID, &s.QuizID, &s.ModuleID, &s.UserID, &rawAnswers,
		&s.Score, &s.MaxScore, &s.IsGraded, &s.GradedBy, &s.StartedAt, &s.SubmittedAt, &s.RetakeAllowed)
	if err != nil {
		return s, err
	}
	if len(rawAnswers) > 0 {
		_ = json.Unmarshal(rawAnswers, &s.Answers)
	}
	if s.Answers == nil {
		s.Answers = []models.SubmissionAnswer{}
	}
	return s, nil
}

func scanQuiz(row interface{ Scan(...any) error }) (models.Quiz, error) {
	var q models.Quiz
	var rawQuestions []byte
	err := row.Scan(&q.ID, &q.CourseID, &q.ModuleID, &q.OrganizationID, &q.Title,
		&q.TimeLimitMins, &rawQuestions, &q.CreatedAt)
	if err != nil {
		return q, err
	}
	if len(rawQuestions) > 0 {
		_ = json.Unmarshal(rawQuestions, &q.Questions)
	}
	if q.Questions == nil {
		q.Questions = []models.Question{}
	}
	return q, nil
}

func CreateQuiz(c *gin.Context) {
	orgID, _ := uuid.Parse(c.GetString("org_id"))
	courseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module id"})
		return
	}

	var quiz models.Quiz
	if err := c.ShouldBindJSON(&quiz); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	quiz.ID = uuid.New()
	quiz.CourseID = courseID
	quiz.ModuleID = moduleID
	quiz.OrganizationID = orgID
	quiz.CreatedAt = time.Now()
	for i := range quiz.Questions {
		quiz.Questions[i].ID = uuid.New()
	}

	questionsJSON, _ := json.Marshal(quiz.Questions)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO quizzes (id, course_id, module_id, organization_id, title, time_limit_mins, questions, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		quiz.ID, quiz.CourseID, quiz.ModuleID, quiz.OrganizationID,
		quiz.Title, quiz.TimeLimitMins, questionsJSON, quiz.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create quiz"})
		return
	}
	c.JSON(http.StatusCreated, quiz)
}

func StartQuiz(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	// QUAL-003: Handle parse error explicitly.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	quiz, err := scanQuiz(db.Pool.QueryRow(ctx,
		`SELECT id, course_id, module_id, organization_id, title, time_limit_mins, questions, created_at
		 FROM quizzes WHERE id = $1`, quizID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}

	existing, existErr := scanSubmission(db.Pool.QueryRow(ctx,
		`SELECT id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, graded_by, started_at, submitted_at, retake_allowed
		 FROM submissions WHERE quiz_id=$1 AND user_id=$2`, quizID, userID))

	if existErr == nil {
		if existing.SubmittedAt != nil && !existing.RetakeAllowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "quiz already submitted"})
			return
		}
		if existing.RetakeAllowed {
			db.Pool.Exec(ctx, `DELETE FROM submissions WHERE id=$1`, existing.ID)
		} else {
			c.JSON(http.StatusOK, existing)
			return
		}
	}

	submission := models.Submission{
		ID:        uuid.New(),
		QuizID:    quizID,
		ModuleID:  quiz.ModuleID,
		UserID:    userID,
		Answers:   []models.SubmissionAnswer{},
		StartedAt: time.Now(),
	}
	answersJSON, _ := json.Marshal(submission.Answers)

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO submissions (id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, started_at, retake_allowed)
		 VALUES ($1, $2, $3, $4, $5, 0, 0, FALSE, $6, FALSE)`,
		submission.ID, submission.QuizID, submission.ModuleID, submission.UserID, answersJSON, submission.StartedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start quiz"})
		return
	}
	c.JSON(http.StatusCreated, submission)
}

func SubmitQuiz(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	// QUAL-003: Handle parse error explicitly.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	var payload struct {
		Answers []models.SubmissionAnswer `json:"answers"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	quiz, err := scanQuiz(db.Pool.QueryRow(ctx,
		`SELECT id, course_id, module_id, organization_id, title, time_limit_mins, questions, created_at
		 FROM quizzes WHERE id = $1`, quizID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}

	submission, err := scanSubmission(db.Pool.QueryRow(ctx,
		`SELECT id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, graded_by, started_at, submitted_at, retake_allowed
		 FROM submissions WHERE quiz_id=$1 AND user_id=$2`, quizID, userID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active quiz session found, please start quiz first"})
		return
	}

	if submission.SubmittedAt != nil && !submission.RetakeAllowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "quiz already submitted"})
		return
	}

	questionMap := make(map[uuid.UUID]models.Question)
	totalMax := 0
	for _, q := range quiz.Questions {
		questionMap[q.ID] = q
		totalMax += q.Points
	}

	score := 0
	for _, ans := range payload.Answers {
		q, ok := questionMap[ans.QuestionID]
		if !ok {
			continue
		}
		if q.Type == models.QuestionMCQSingle && ans.SelectedIndex != nil {
			if *ans.SelectedIndex >= 0 && *ans.SelectedIndex < len(q.Choices) {
				if q.Choices[*ans.SelectedIndex].IsRight {
					score += q.Points
				}
			}
		} else if q.Type == models.QuestionMCQMulti && len(ans.SelectedIndices) > 0 {
			correctCount := 0
			for _, ch := range q.Choices {
				if ch.IsRight {
					correctCount++
				}
			}
			selectedCorrect := 0
			selectedIncorrect := 0
			for _, idx := range ans.SelectedIndices {
				if idx >= 0 && idx < len(q.Choices) {
					if q.Choices[idx].IsRight {
						selectedCorrect++
					} else {
						selectedIncorrect++
					}
				}
			}
			if selectedCorrect == correctCount && selectedIncorrect == 0 {
				score += q.Points
			}
		}
	}

	answersJSON, _ := json.Marshal(payload.Answers)
	now := time.Now()

	_, err = db.Pool.Exec(ctx,
		`UPDATE submissions SET answers=$1, score=$2, max_score=$3, submitted_at=$4, retake_allowed=FALSE WHERE id=$5`,
		answersJSON, score, totalMax, now, submission.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save submission"})
		return
	}

	submission.Answers = payload.Answers
	submission.Score = score
	submission.MaxScore = totalMax
	submission.SubmittedAt = &now
	submission.RetakeAllowed = false
	c.JSON(http.StatusOK, submission)
}

func ListSubmissions(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	// BL-006: Verify the quiz belongs to the calling admin's organization
	// before returning any submission data.
	callerOrgID, err := uuid.Parse(c.GetString("org_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid org context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var quizOrgID uuid.UUID
	if err := db.Pool.QueryRow(ctx,
		`SELECT organization_id FROM quizzes WHERE id=$1`, quizID).Scan(&quizOrgID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}
	if quizOrgID != callerOrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: quiz belongs to a different organization"})
		return
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, graded_by, started_at, submitted_at, retake_allowed
		 FROM submissions WHERE quiz_id = $1`, quizID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch submissions"})
		return
	}
	defer rows.Close()

	subs := []models.Submission{}
	for rows.Next() {
		s, err := scanSubmission(rows)
		if err == nil {
			subs = append(subs, s)
		}
	}
	c.JSON(http.StatusOK, subs)
}

func UnlockQuizRetake(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`UPDATE submissions SET retake_allowed=TRUE WHERE quiz_id=$1 AND user_id=$2`, quizID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not unlock retake"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "retake unlocked"})
}

func UpdateQuiz(c *gin.Context) {
	quizIDStr := c.Param("quizId")
	quizID, err := uuid.Parse(quizIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	var quiz models.Quiz
	if err := c.ShouldBindJSON(&quiz); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	questionsJSON, err := json.Marshal(quiz.Questions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal questions"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = db.Pool.Exec(ctx,
		`UPDATE quizzes SET title=$1, time_limit_mins=$2, questions=$3 WHERE id=$4`,
		quiz.Title, quiz.TimeLimitMins, questionsJSON, quizID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update quiz"})
		return
	}

	quiz.ID = quizID
	c.JSON(http.StatusOK, quiz)
}

func GetQuiz(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	role := c.GetString("role")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	quiz, err := scanQuiz(db.Pool.QueryRow(ctx,
		`SELECT id, course_id, module_id, organization_id, title, time_limit_mins, questions, created_at
		 FROM quizzes WHERE id = $1`, quizID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}

	if role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin) {
		userID, _ := uuid.Parse(c.GetString("user_id"))
		existing, existErr := scanSubmission(db.Pool.QueryRow(ctx,
			`SELECT id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, graded_by, started_at, submitted_at, retake_allowed
			 FROM submissions WHERE quiz_id=$1 AND user_id=$2`, quizID, userID))

		hasSubmitted := existErr == nil && existing.SubmittedAt != nil && !existing.RetakeAllowed

		if !hasSubmitted {
			for i := range quiz.Questions {
				quiz.Questions[i].CorrectIndex = 0
				for j := range quiz.Questions[i].Choices {
					quiz.Questions[i].Choices[j].IsRight = false
				}
			}
		}
	}

	c.JSON(http.StatusOK, quiz)
}

func GetMyQuizSubmission(c *gin.Context) {
	quizID, err := uuid.Parse(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	// QUAL-003: Handle parse error explicitly.
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	existing, err := scanSubmission(db.Pool.QueryRow(ctx,
		`SELECT id, quiz_id, module_id, user_id, answers, score, max_score, is_graded, graded_by, started_at, submitted_at, retake_allowed
		 FROM submissions WHERE quiz_id=$1 AND user_id=$2`, quizID, userID))
	if err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, existing)
}
