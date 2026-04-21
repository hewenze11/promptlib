package handler

import (
	"fmt"
	"net/http"
	"promptlib-backend/model"
	"strings"

	"github.com/gin-gonic/gin"
)

// GET /api/libraries/:id/entries
func ListEntries(c *gin.Context) {
	userID := c.GetUint("user_id")
	libID := c.Param("id")
	var lib model.Library
	if err := model.DB.First(&lib, "id = ?", libID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词库不存在"})
		return
	}
	if lib.UserID != userID && lib.Visibility == "private" {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问"})
		return
	}
	var entries []model.Entry
	model.DB.Where("library_id = ?", libID).Order("sort_order asc, created_at asc").Find(&entries)
	c.JSON(http.StatusOK, gin.H{"data": entries, "total": len(entries)})
}

// POST /api/libraries/:id/entries
func CreateEntry(c *gin.Context) {
	userID := c.GetUint("user_id")
	libID := c.Param("id")
	var lib model.Library
	if err := model.DB.First(&lib, "id = ? AND user_id = ?", libID, userID).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	var req struct {
		ID          string `json:"id" binding:"required"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Color       string `json:"color"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 清理标题：trim 空格，校验长度
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "词条名称不能为空"})
		return
	}
	if len([]rune(req.Title)) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "词条名称不能超过64个字符"})
		return
	}

	if req.Color == "" {
		req.Color = "#7c3aed"
	}

	// 同库同名处理：自动加 _01 _02 ... 后缀
	finalTitle := req.Title
	var count int64
	model.DB.Model(&model.Entry{}).Where("library_id = ? AND title = ?", libID, req.Title).Count(&count)
	if count > 0 {
		for i := 1; i <= 99; i++ {
			candidate := fmt.Sprintf("%s_%02d", req.Title, i)
			var c2 int64
			model.DB.Model(&model.Entry{}).Where("library_id = ? AND title = ?", libID, candidate).Count(&c2)
			if c2 == 0 {
				finalTitle = candidate
				break
			}
		}
	}

	entry := model.Entry{
		ID:          req.ID,
		LibraryID:   libID,
		Title:       finalTitle,
		Description: req.Description,
		Color:       req.Color,
		SortOrder:   req.SortOrder,
	}
	if err := model.DB.Create(&entry).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "创建失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, entry)
}

// PUT /api/libraries/:id/entries/:eid
func UpdateEntry(c *gin.Context) {
	userID := c.GetUint("user_id")
	libID := c.Param("id")
	if err := model.DB.First(&model.Library{}, "id = ? AND user_id = ?", libID, userID).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	var entry model.Entry
	if err := model.DB.First(&entry, "id = ? AND library_id = ?", c.Param("eid"), libID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "词条不存在"})
		return
	}
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Color       *string `json:"color"`
		SortOrder   *int    `json:"sort_order"`
	}
	c.ShouldBindJSON(&req)
	updates := map[string]interface{}{}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "词条名称不能为空"})
			return
		}
		if len([]rune(t)) > 64 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "词条名称不能超过64个字符"})
			return
		}
		updates["title"] = t
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Color != nil {
		updates["color"] = *req.Color
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	model.DB.Model(&entry).Updates(updates)
	c.JSON(http.StatusOK, entry)
}

// DELETE /api/libraries/:id/entries/:eid
func DeleteEntry(c *gin.Context) {
	userID := c.GetUint("user_id")
	libID := c.Param("id")
	if err := model.DB.First(&model.Library{}, "id = ? AND user_id = ?", libID, userID).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权操作"})
		return
	}
	result := model.DB.Where("id = ? AND library_id = ?", c.Param("eid"), libID).Delete(&model.Entry{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "词条不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
