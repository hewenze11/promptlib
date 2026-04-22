package handler

import (
	"net/http"
	"promptlib-backend/model"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GET /admin/configs
func GetConfigs(c *gin.Context) {
	var configs []model.SystemConfig
	model.DB.Find(&configs)
	c.JSON(http.StatusOK, gin.H{"data": configs})
}

// PUT /admin/configs/:key
func UpdateConfig(c *gin.Context) {
	key := c.Param("key")
	var req struct {
		Value string `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cfg := model.SystemConfig{Key: key, Value: req.Value, UpdatedAt: time.Now()}
	model.DB.Save(&cfg)
	c.JSON(http.StatusOK, gin.H{"data": cfg})
}

// GET /admin/users
func AdminListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	keyword := c.Query("keyword")
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size

	q := model.DB.Model(&model.User{})
	if keyword != "" {
		q = q.Where("username LIKE ? OR email LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	var total int64
	q.Count(&total)
	var users []model.User
	q.Order("id desc").Offset(offset).Limit(size).Find(&users)
	c.JSON(http.StatusOK, gin.H{"data": users, "total": total, "page": page, "size": size})
}

// PUT /admin/users/:id/role
func UpdateUserRole(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Role int `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := model.DB.Model(&model.User{}).Where("id = ?", id).Update("role", req.Role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// GET /admin/libraries
func AdminListLibraries(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	keyword := c.Query("keyword")
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size

	q := model.DB.Model(&model.Library{})
	if keyword != "" {
		q = q.Where("name LIKE ? OR slug LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	var total int64
	q.Count(&total)
	var libs []model.Library
	q.Order("created_at desc").Offset(offset).Limit(size).Find(&libs)
	c.JSON(http.StatusOK, gin.H{"data": libs, "total": total, "page": page, "size": size})
}

// PUT /admin/libraries/:id/visibility
func AdminUpdateLibraryVisibility(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Visibility string `json:"visibility"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := model.DB.Model(&model.Library{}).Where("id = ?", id).Update("visibility", req.Visibility).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// GET /admin/stats
func GetStats(c *gin.Context) {
	var totalUsers, totalLibraries, totalEntries, todayUsers int64
	model.DB.Model(&model.User{}).Count(&totalUsers)
	model.DB.Model(&model.Library{}).Count(&totalLibraries)
	model.DB.Model(&model.Entry{}).Count(&totalEntries)
	today := time.Now().Format("2006-01-02")
	model.DB.Model(&model.User{}).Where("DATE(created_at) = ?", today).Count(&todayUsers)
	c.JSON(http.StatusOK, gin.H{
		"total_users":     totalUsers,
		"total_libraries": totalLibraries,
		"total_entries":   totalEntries,
		"today_users":     todayUsers,
	})
}
