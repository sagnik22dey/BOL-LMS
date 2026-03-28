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

func CreateQuiz(c *gin.Context) {
	orgID, _ := primitive.ObjectIDFromHex(c.GetString("org_id"))
	courseID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}
	moduleID, err := primitive.ObjectIDFromHex(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module id"})
		return
	}

	var quiz models.Quiz
	if err := c.ShouldBindJSON(&quiz); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	quiz.ID = primitive.NewObjectID()
	quiz.CourseID = courseID
	quiz.ModuleID = moduleID
	quiz.OrganizationID = orgID
	quiz.CreatedAt = time.Now()
	for i := range quiz.Questions {
		quiz.Questions[i].ID = primitive.NewObjectID()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.Collection("quizzes").InsertOne(ctx, quiz); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create quiz"})
		return
	}
	c.JSON(http.StatusCreated, quiz)
}

func StartQuiz(c *gin.Context) {
	quizID, err := primitive.ObjectIDFromHex(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var quiz models.Quiz
	if err := db.Collection("quizzes").FindOne(ctx, bson.M{"_id": quizID}).Decode(&quiz); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}

	var existing models.Submission
	err = db.Collection("submissions").FindOne(ctx, bson.M{"quiz_id": quizID, "user_id": userID}).Decode(&existing)
	if err == nil {
		if !existing.SubmittedAt.IsZero() && !existing.RetakeAllowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "quiz already submitted"})
			return
		}
		if existing.RetakeAllowed {
			db.Collection("submissions").DeleteOne(ctx, bson.M{"_id": existing.ID})
		} else {
			c.JSON(http.StatusOK, existing)
			return
		}
	}

	submission := models.Submission{
		ID:        primitive.NewObjectID(),
		QuizID:    quizID,
		ModuleID:  quiz.ModuleID,
		UserID:    userID,
		StartedAt: time.Now(),
	}

	if _, err := db.Collection("submissions").InsertOne(ctx, submission); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start quiz"})
		return
	}
	c.JSON(http.StatusCreated, submission)
}

func SubmitQuiz(c *gin.Context) {
	quizID, err := primitive.ObjectIDFromHex(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	var payload struct {
		Answers []models.SubmissionAnswer `json:"answers"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var quiz models.Quiz
	if err := db.Collection("quizzes").FindOne(ctx, bson.M{"_id": quizID}).Decode(&quiz); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}

	var submission models.Submission
	if err := db.Collection("submissions").FindOne(ctx, bson.M{"quiz_id": quizID, "user_id": userID}).Decode(&submission); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active quiz session found, please start quiz first"})
		return
	}

	if !submission.SubmittedAt.IsZero() && !submission.RetakeAllowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "quiz already submitted"})
		return
	}

	questionMap := make(map[primitive.ObjectID]models.Question)
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

	update := bson.M{
		"$set": bson.M{
			"answers":        payload.Answers,
			"score":          score,
			"max_score":      totalMax,
			"submitted_at":   time.Now(),
			"retake_allowed": false,
		},
	}

	if _, err := db.Collection("submissions").UpdateOne(ctx, bson.M{"_id": submission.ID}, update); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save submission"})
		return
	}

	db.Collection("submissions").FindOne(ctx, bson.M{"_id": submission.ID}).Decode(&submission)
	c.JSON(http.StatusOK, submission)
}

func ListSubmissions(c *gin.Context) {
	quizID, err := primitive.ObjectIDFromHex(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.Collection("submissions").Find(ctx, bson.M{"quiz_id": quizID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch submissions"})
		return
	}
	defer cursor.Close(ctx)

	var subs []models.Submission
	cursor.All(ctx, &subs)
	c.JSON(http.StatusOK, subs)
}

func UnlockQuizRetake(c *gin.Context) {
	quizID, err := primitive.ObjectIDFromHex(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	userID, err := primitive.ObjectIDFromHex(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{"$set": bson.M{"retake_allowed": true}}
	_, err = db.Collection("submissions").UpdateOne(ctx, bson.M{"quiz_id": quizID, "user_id": userID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not unlock retake"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "retake unlocked"})
}

func GetQuiz(c *gin.Context) {
	quizID, err := primitive.ObjectIDFromHex(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}

	role := c.GetString("role")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var quiz models.Quiz
	if err := db.Collection("quizzes").FindOne(ctx, bson.M{"_id": quizID}).Decode(&quiz); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "quiz not found"})
		return
	}

	if role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin) {
		userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
		var existing models.Submission
		err := db.Collection("submissions").FindOne(ctx, bson.M{"quiz_id": quizID, "user_id": userID}).Decode(&existing)
		
		hasSubmitted := err == nil && !existing.SubmittedAt.IsZero() && !existing.RetakeAllowed

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
	quizID, err := primitive.ObjectIDFromHex(c.Param("quizId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid quiz id"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.Submission
	err = db.Collection("submissions").FindOne(ctx, bson.M{"quiz_id": quizID, "user_id": userID}).Decode(&existing)
	if err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}

	c.JSON(http.StatusOK, existing)
}
