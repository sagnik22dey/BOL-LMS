package router

import (
	"net/http"
	"time"

	"bol-lms-server/internal/handlers"
	"bol-lms-server/internal/middleware"
	"bol-lms-server/internal/models"
	"bol-lms-server/internal/ws"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:80"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")

	auth := api.Group("/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
		auth.GET("/me", middleware.AuthRequired(), handlers.Me)
		auth.GET("/organizations/my", middleware.AuthRequired(), handlers.GetMyOrganization)
	}

	superAdmin := api.Group("/admin/super")
	superAdmin.Use(middleware.AuthRequired(), middleware.RequireRole(models.RoleSuperAdmin))
	{
		superAdmin.GET("/analytics", handlers.GetSuperAdminAnalytics)
		superAdmin.POST("/organizations", handlers.CreateOrganization)
		superAdmin.GET("/organizations", handlers.ListOrganizations)
		superAdmin.PUT("/organizations/:id", handlers.UpdateOrganization)
		superAdmin.POST("/organizations/:id/assign-user", handlers.AssignUserToOrg)
		superAdmin.POST("/admins", handlers.CreateAdmin)
		superAdmin.GET("/users", handlers.GetSuperAdminsUsers)
		superAdmin.GET("/users/unassigned", handlers.GetUnassignedUsers)
		superAdmin.DELETE("/users/:id", handlers.DeleteUser)
		superAdmin.PATCH("/users/:id/suspend", handlers.SuspendUser)
	}

	admin := api.Group("/admin")
	admin.Use(middleware.AuthRequired(), middleware.RequireRole(models.RoleAdmin))
	{
		admin.POST("/users", handlers.CreateOrganizationUser)
		admin.GET("/users", handlers.GetOrganizationUsers)

		// Group management
		admin.POST("/groups", handlers.CreateGroup)
		admin.GET("/groups", handlers.ListGroups)
		admin.GET("/groups/:id", handlers.GetGroup)
		admin.PUT("/groups/:id", handlers.UpdateGroup)
		admin.DELETE("/groups/:id", handlers.DeleteGroup)
		admin.POST("/groups/:id/users", handlers.AddUsersToGroup)
		admin.DELETE("/groups/:id/users/:userId", handlers.RemoveUserFromGroup)
		admin.POST("/groups/:id/courses", handlers.AssignCoursesToGroup)
		admin.DELETE("/groups/:id/courses/:courseId", handlers.RemoveCourseFromGroup)

		// Individual course assignments
		admin.POST("/users/:id/courses", handlers.AssignCourseToUser)
		admin.DELETE("/users/:id/courses/:courseId", handlers.RevokeCourseFromUser)
		admin.GET("/users/:id/courses", handlers.GetUserIndividualCourses)
	}

	// Shared user management for Admin and SuperAdmin
	manage := api.Group("/admin/manage")
	manage.Use(middleware.AuthRequired(), middleware.RequireRole(models.RoleAdmin, models.RoleSuperAdmin))
	{
		manage.DELETE("/users/:id", handlers.DeleteUser)
		manage.PATCH("/users/:id/suspend", handlers.SuspendUser)
		manage.POST("/notifications", handlers.CreateNotification)
	}

	courses := api.Group("/courses")
	courses.Use(middleware.AuthRequired())
	{
		// Shared routes for any authenticated user (scoping handled in handler)
		courses.GET("", handlers.ListCourses)
		courses.GET("/:id", handlers.GetCourse)
		courses.POST("/presign", handlers.GeneratePresignURL)

		// Admin-only routes
		adminCourses := courses.Group("")
		adminCourses.Use(middleware.RequireRole(models.RoleAdmin))
		{
			adminCourses.POST("", handlers.CreateCourse)
			adminCourses.PUT("/:id", handlers.UpdateCourse)
			adminCourses.DELETE("/:id", handlers.DeleteCourse)
			adminCourses.POST("/:id/modules/:moduleId/quizzes", handlers.CreateQuiz)
			adminCourses.GET("/:id/modules/:moduleId/quizzes/:quizId/submissions", handlers.ListSubmissions)
			adminCourses.POST("/:id/modules/:moduleId/assignments", handlers.CreateAssignment)
			adminCourses.GET("/:id/modules/:moduleId/assessments", handlers.GetModuleAssessments)
			adminCourses.PATCH("/:id/modules/:moduleId/quizzes/:quizId/retake/:userId", handlers.UnlockQuizRetake)
			adminCourses.PATCH("/:id/modules/:moduleId/assignments/:assignmentId/reset/:userId", handlers.ResetAssignment)
		}

		// Comment routes
		courses.GET("/modules/:moduleId/comments", handlers.ListComments)
		courses.POST("/modules/:moduleId/comments", handlers.CreateComment)
	}

	studentCourses := api.Group("/learning")
	studentCourses.Use(middleware.AuthRequired()) // Any authenticated user
	{
		studentCourses.GET("/presign-get", handlers.GeneratePresignGetURL)
		studentCourses.POST("/enroll", handlers.EnrollUser)
		studentCourses.GET("/my-courses", handlers.ListMyEnrollments)
	}

	quizzes := api.Group("/quizzes")
	quizzes.Use(middleware.AuthRequired(), middleware.RequireRole(models.RoleUser, models.RoleAdmin, models.RoleSuperAdmin))
	{
		quizzes.GET("/:quizId", handlers.GetQuiz)
		quizzes.GET("/:quizId/my-submission", handlers.GetMyQuizSubmission)
		quizzes.POST("/:quizId/start", handlers.StartQuiz)
		quizzes.POST("/:quizId/submit", handlers.SubmitQuiz)
	}

	assignments := api.Group("/assignments")
	assignments.Use(middleware.AuthRequired(), middleware.RequireRole(models.RoleUser, models.RoleAdmin, models.RoleSuperAdmin))
	{
		assignments.GET("/:assignmentId", handlers.GetAssignment)
		assignments.GET("/:assignmentId/my-submission", handlers.GetMyAssignmentSubmission)
		assignments.POST("/:assignmentId/submit", handlers.SubmitAssignment)
	}

	notifications := api.Group("/notifications")
	notifications.Use(middleware.AuthRequired())
	{
		notifications.GET("", handlers.GetLatestNotifications)
	}

	dashboard := api.Group("/dashboard")
	dashboard.Use(middleware.AuthRequired())
	{
		dashboard.GET("/stats", handlers.GetDashboardStats)
	}

	// WebSocket endpoint
	r.GET("/ws/comments/:moduleId", func(c *gin.Context) {
		ws.ServeWs(ws.GlobalHub, c)
	})

	return r
}
