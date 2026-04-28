package handler

import (
	"net/http"
	"promptlib-backend/model"

	"github.com/gin-gonic/gin"
)

// GET /api/active-libs  — 激活的库列表，含词条
func GetActiveLibs(c *gin.Context) {
	userID := c.GetUint("user_id")
	var actives []model.UserActiveLib
	model.DB.Where("user_id = ?", userID).Order("sort_order asc").Find(&actives)

	type LibWithEntries struct {
		model.Library
		Entries []model.Entry `json:"entries"`
	}
	result := []LibWithEntries{}
	for _, a := range actives {
		var lib model.Library
		if err := model.DB.Preload("Tags").First(&lib, "id = ?", a.LibraryID).Error; err != nil {
			continue
		}
		var entries []model.Entry
		model.DB.Where("library_id = ?", lib.ID).Order("sort_order asc").Find(&entries)
		result = append(result, LibWithEntries{Library: lib, Entries: entries})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// PUT /api/active-libs  — 更新激活列表
func UpdateActiveLibs(c *gin.Context) {
	userID := c.GetUint("user_id")
	var req []struct {
		LibraryID string `json:"library_id"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// 清掉旧的，重写
	model.DB.Where("user_id = ?", userID).Delete(&model.UserActiveLib{})
	for _, item := range req {
		if item.LibraryID == "" {
			continue
		}
		var exists int64
		model.DB.Model(&model.Library{}).Where("id = ? AND user_id = ?", item.LibraryID, userID).Count(&exists)
		if exists == 0 {
			continue
		}
		model.DB.Create(&model.UserActiveLib{
			UserID:    userID,
			LibraryID: item.LibraryID,
			SortOrder: item.SortOrder,
		})
	}
	c.JSON(http.StatusOK, gin.H{"message": "已更新"})
}
