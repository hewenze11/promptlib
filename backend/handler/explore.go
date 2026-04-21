package handler

import (
	"net/http"
	"promptlib-backend/model"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GET /api/explore?q=&tag=&sort=stars|newest&page=1&page_size=20
func Explore(c *gin.Context) {
	q := c.Query("q")
	tag := c.Query("tag")
	sort := c.DefaultQuery("sort", "stars")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := model.DB.Model(&model.Library{}).Preload("Tags").Preload("User").
		Where("visibility = 'public'")

	if q != "" {
		query = query.Where("name LIKE ? OR description LIKE ?", "%"+q+"%", "%"+q+"%")
	}
	if tag != "" {
		query = query.Joins("JOIN library_tags ON library_tags.library_id = libraries.id AND library_tags.tag = ?", tag)
	}

	switch sort {
	case "newest":
		query = query.Order("libraries.created_at desc")
	default:
		query = query.Order("libraries.star_count desc, libraries.created_at desc")
	}

	var total int64
	query.Count(&total)

	var libs []model.Library
	query.Offset((page - 1) * pageSize).Limit(pageSize).Find(&libs)

	c.JSON(http.StatusOK, gin.H{"data": libs, "total": total, "page": page, "page_size": pageSize})
}

// GET /api/explore/tags
func ExploreTags(c *gin.Context) {
	type TagCount struct {
		Tag   string `json:"tag"`
		Count int    `json:"count"`
	}
	var tags []TagCount
	model.DB.Raw(`
		SELECT lt.tag, COUNT(*) as count
		FROM library_tags lt
		JOIN libraries l ON l.id = lt.library_id AND l.visibility = 'public'
		GROUP BY lt.tag
		ORDER BY count DESC
		LIMIT 30
	`).Scan(&tags)
	c.JSON(http.StatusOK, gin.H{"data": tags})
}

// GET /api/users/:username
func GetUserProfile(c *gin.Context) {
	var user model.User
	if err := model.DB.Where("username = ?", c.Param("username")).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	var libs []model.Library
	model.DB.Preload("Tags").Where("user_id = ? AND visibility = 'public'", user.ID).
		Order("star_count desc").Find(&libs)
	c.JSON(http.StatusOK, gin.H{
		"user":      userResponse(user),
		"libraries": libs,
		"total":     len(libs),
	})
}

// GET /api/users/:username/:slug
func GetPublicLibrary(c *gin.Context) {
	var owner model.User
	if err := model.DB.Where("username = ?", c.Param("username")).First(&owner).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	var lib model.Library
	if err := model.DB.Preload("Tags").First(&lib,
		"user_id = ? AND slug = ? AND visibility IN ('public','unlisted')", owner.ID, c.Param("slug"),
	).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}
	var entries []model.Entry
	model.DB.Where("library_id = ?", lib.ID).Order("sort_order asc, created_at asc").Find(&entries)
	c.JSON(http.StatusOK, gin.H{"library": lib, "entries": entries, "owner": userResponse(owner)})
}
