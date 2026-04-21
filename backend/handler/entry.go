package handler

import (
	"net/http"
	"promptlib-backend/model"

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
	if req.Color == "" {
		req.Color = "#7c3aed"
	}
	entry := model.Entry{
		ID:          req.ID,
		LibraryID:   libID,
		Title:       req.Title,
		Description: req.Description,
		Color:       req.Color,
		SortOrder:   req.SortOrder,
	}
	if err := model.DB.Create(&entry).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "词条名称已存在"})
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
		updates["title"] = *req.Title
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
