package router

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"bol-lms-server/internal/handlers"
	"bol-lms-server/internal/middleware"
	"bol-lms-server/internal/models"
	"bol-lms-server/internal/ws"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// allowedOrigins builds the CORS origin list at startup.
// Always includes localhost variants for development.
// Add any extra origins via the ALLOWED_ORIGINS env var as a comma-separated list,
// e.g. ALLOWED_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com
// Use ALLOWED_ORIGINS=* to allow all origins (disables credentials).
func allowedOrigins() []string {
	base := []string{
		// Local development
		"http://localhost:5173",
		"http://localhost:3000",
		"http://localhost:80",
		"http://localhost",
		// Railway production frontend
		"https://bol-lms-copy-frontend.up.railway.app",
	}
	if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				base = append(base, o)
			}
		}
	}
	log.Printf("[CORS] allowedOrigins=%v", base)
	return base
}

func Setup() *gin.Engine {
	r := gin.Default()

	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// If ALLOWED_ORIGINS=* allow all origins (credentials must be disabled per CORS spec).
	// Otherwise use the explicit origin list with credentials enabled.
	if raw := os.Getenv("ALLOWED_ORIGINS"); raw == "*" {
		log.Println("[CORS] AllowAllOrigins=true, AllowCredentials=false")
		corsConfig.AllowAllOrigins = true
		corsConfig.AllowCredentials = false
	} else {
		corsConfig.AllowOrigins = allowedOrigins()
	}

	r.Use(cors.New(corsConfig))

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

		// Course Bundle management
		admin.POST("/course-bundles", handlers.CreateCourseBundle)
		admin.GET("/course-bundles", handlers.ListCourseBundles)
		admin.GET("/course-bundles/:id", handlers.GetCourseBundle)
		admin.PUT("/course-bundles/:id", handlers.UpdateCourseBundle)
		admin.DELETE("/course-bundles/:id", handlers.DeleteCourseBundle)
		admin.POST("/course-bundles/:id/users", handlers.AddUsersToCourseBundle)
		admin.DELETE("/course-bundles/:id/users/:userId", handlers.RemoveUserFromCourseBundle)
		admin.POST("/course-bundles/:id/courses", handlers.AssignCoursesToCourseBundle)
		admin.DELETE("/course-bundles/:id/courses/:courseId", handlers.RemoveCourseFromCourseBundle)

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

	payments := api.Group("/payments")
	payments.Use(middleware.AuthRequired())
	{
		payments.GET("/cart", handlers.GetCart)
		payments.POST("/cart", handlers.AddToCart)
		payments.DELETE("/cart/:itemId", handlers.RemoveFromCart)
		payments.DELETE("/cart", handlers.ClearCart)
		payments.POST("/checkout/dummy", handlers.DummyCheckout)
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
