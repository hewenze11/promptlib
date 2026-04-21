package main

import (
	"log"
	"os"
	"promptlib-backend/handler"
	"promptlib-backend/middleware"
	"promptlib-backend/model"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := model.InitDB(); err != nil {
		log.Fatalf("db init: %v", err)
	}

	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// 公开接口
	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.POST("/api/auth/register", handler.Register)
	r.POST("/api/auth/login", handler.Login)
	r.GET("/api/explore", handler.Explore)
	r.GET("/api/explore/tags", handler.ExploreTags)
	r.GET("/api/users/:username", handler.GetUserProfile)
	r.GET("/api/users/:username/:slug", handler.GetPublicLibrary)

	// 需要登录
	auth := r.Group("/api", middleware.Auth())
	{
		auth.GET("/user/self", handler.GetSelf)
		auth.PUT("/user/self", handler.UpdateSelf)

		auth.GET("/libraries", handler.ListLibraries)
		auth.POST("/libraries", handler.CreateLibrary)
		auth.GET("/libraries/:id", handler.GetLibrary)
		auth.PUT("/libraries/:id", handler.UpdateLibrary)
		auth.DELETE("/libraries/:id", handler.DeleteLibrary)

		auth.GET("/libraries/:id/entries", handler.ListEntries)
		auth.POST("/libraries/:id/entries", handler.CreateEntry)
		auth.PUT("/libraries/:id/entries/:eid", handler.UpdateEntry)
		auth.DELETE("/libraries/:id/entries/:eid", handler.DeleteEntry)

		auth.POST("/libraries/:id/star", handler.StarLibrary)
		auth.DELETE("/libraries/:id/star", handler.UnstarLibrary)
		auth.POST("/users/:username/:slug/fork", handler.ForkLibrary)

		auth.GET("/active-libs", handler.GetActiveLibs)
		auth.PUT("/active-libs", handler.UpdateActiveLibs)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("listening :%s", port)
	r.Run(":" + port)
}
