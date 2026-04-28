package handler

import (
	"net/http"
	"promptlib-backend/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GET /api/libraries
func ListLibraries(c *gin.Context) {
	var libs []model.Library
	model.DB.Preload("Tags").Where("user_id = ?", c.GetUint("user_id")).Order("created_at desc").Find(&libs)
	c.JSON(http.StatusOK, gin.H{"data": libs, "total": len(libs)})
}

// POST /api/libraries
func CreateLibrary(c *gin.Context) {
	var req struct {
		Name        string   `json:"name" binding:"required"`
		Slug        string   `json:"slug" binding:"required"`
		Description string   `json:"description"`
		Visibility  string   `json:"visibility"`
		Tags        []string `json:"tags"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Visibility == "" {
		req.Visibility = "private"
	}
	var exists int64
	model.DB.Model(&model.Library{}).Where("user_id = ? AND slug = ?", c.GetUint("user_id"), req.Slug).Count(&exists)
	if exists > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "slug 已存在"})
		return
	}
	lib := model.Library{
		ID:          uuid.New().String(),
		UserID:      c.GetUint("user_id"),
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Visibility:  req.Visibility,
	}
	if err := model.DB.Create(&lib).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "slug 已存在"})
		return
	}
	// 写标签
	for _, tag := range req.Tags {
		model.DB.Create(&model.LibraryTag{LibraryID: lib.ID, Tag: tag})
	}
	model.DB.Preload("Tags").First(&lib, "id = ?", lib.ID)
	c.JSON(http.StatusOK, lib)
}

// GET /api/libraries/:id
func GetLibrary(c *gin.Context) {
	userID := c.GetUint("user_id")
	var lib model.Library
	if err := model.DB.Preload("Tags").First(&lib, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}
	if lib.UserID != userID && lib.Visibility == "private" {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问"})
		return
	}
	c.JSON(http.StatusOK, lib)
}

// PUT /api/libraries/:id
func UpdateLibrary(c *gin.Context) {
	userID := c.GetUint("user_id")
	var lib model.Library
	if err := model.DB.First(&lib, "id = ? AND user_id = ?", c.Param("id"), userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}
	var req struct {
		Name        *string  `json:"name"`
		Description *string  `json:"description"`
		Visibility  *string  `json:"visibility"`
		Tags        []string `json:"tags"`
	}
	c.ShouldBindJSON(&req)
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Visibility != nil {
		updates["visibility"] = *req.Visibility
	}
	if len(updates) > 0 {
		model.DB.Model(&lib).Updates(updates)
	}
	if req.Tags != nil {
		model.DB.Where("library_id = ?", lib.ID).Delete(&model.LibraryTag{})
		for _, tag := range req.Tags {
			model.DB.Create(&model.LibraryTag{LibraryID: lib.ID, Tag: tag})
		}
	}
	model.DB.Preload("Tags").First(&lib, "id = ?", lib.ID)
	c.JSON(http.StatusOK, lib)
}

// DELETE /api/libraries/:id
func DeleteLibrary(c *gin.Context) {
	userID := c.GetUint("user_id")
	libID := c.Param("id")

	var lib model.Library
	if err := model.DB.First(&lib, "id = ? AND user_id = ?", libID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Library{}).Where("fork_from_id = ?", libID).Update("fork_from_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Where("library_id = ?", libID).Delete(&model.Entry{}).Error; err != nil {
			return err
		}
		if err := tx.Where("library_id = ?", libID).Delete(&model.LibraryTag{}).Error; err != nil {
			return err
		}
		if err := tx.Where("library_id = ?", libID).Delete(&model.LibraryStar{}).Error; err != nil {
			return err
		}
		if err := tx.Where("library_id = ?", libID).Delete(&model.UserActiveLib{}).Error; err != nil {
			return err
		}
		result := tx.Where("id = ? AND user_id = ?", libID, userID).Delete(&model.Library{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}

// POST /api/libraries/:id/star
func StarLibrary(c *gin.Context) {
	libID := c.Param("id")
	var lib model.Library
	if err := model.DB.First(&lib, "id = ? AND visibility != 'private'", libID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}
	star := model.LibraryStar{UserID: c.GetUint("user_id"), LibraryID: libID}
	if err := model.DB.Create(&star).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "已点星"}) // 幂等
		return
	}
	model.DB.Model(&model.Library{}).Where("id = ?", libID).UpdateColumn("star_count", lib.StarCount+1)
	c.JSON(http.StatusOK, gin.H{"message": "点星成功"})
}

// DELETE /api/libraries/:id/star
func UnstarLibrary(c *gin.Context) {
	libID := c.Param("id")
	result := model.DB.Where("user_id = ? AND library_id = ?", c.GetUint("user_id"), libID).Delete(&model.LibraryStar{})
	if result.RowsAffected > 0 {
		model.DB.Model(&model.Library{}).Where("id = ?", libID).UpdateColumn("star_count", gorm.Expr("GREATEST(star_count - 1, 0)"))
	}
	c.JSON(http.StatusOK, gin.H{"message": "已取消"})
}

// POST /api/users/:username/:slug/fork
func ForkLibrary(c *gin.Context) {
	userID := c.GetUint("user_id")
	// 找原库
	var owner model.User
	if err := model.DB.Where("username = ?", c.Param("username")).First(&owner).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	var src model.Library
	if err := model.DB.Preload("Tags").First(&src, "user_id = ? AND slug = ? AND visibility != 'private'", owner.ID, c.Param("slug")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}
	srcID := src.ID
	newSlug := src.Slug + "-fork"
	var exists int64
	model.DB.Model(&model.Library{}).Where("user_id = ? AND slug = ?", userID, newSlug).Count(&exists)
	if exists > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "slug 已存在，请先修改"})
		return
	}
	newLib := model.Library{
		ID:          uuid.New().String(),
		UserID:      userID,
		Name:        src.Name,
		Slug:        newSlug,
		Description: src.Description,
		Visibility:  "private",
		ForkFromID:  &srcID,
	}
	if err := model.DB.Create(&newLib).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "slug 已存在，请先修改"})
		return
	}
	// 复制词条
	var entries []model.Entry
	model.DB.Where("library_id = ?", src.ID).Find(&entries)
	for _, e := range entries {
		newEntry := e
		newEntry.ID = uuid.New().String()
		newEntry.LibraryID = newLib.ID
		model.DB.Create(&newEntry)
	}
	// 复制标签
	for _, t := range src.Tags {
		model.DB.Create(&model.LibraryTag{LibraryID: newLib.ID, Tag: t.Tag})
	}
	// 更新原库 fork 计数
	model.DB.Model(&model.Library{}).Where("id = ?", src.ID).UpdateColumn("fork_count", src.ForkCount+1)
	c.JSON(http.StatusOK, newLib)
}
