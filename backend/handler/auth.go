package handler

import (
	"net/http"
	"os"
	"promptlib-backend/middleware"
	"promptlib-backend/model"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func makeToken(userID uint) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(middleware.JWTSecret())
}

func userResponse(u model.User) gin.H {
	email := ""
	if u.Email != nil {
		email = *u.Email
	}
	return gin.H{"id": u.ID, "username": u.Username, "email": email, "role": u.Role}
}

// POST /api/auth/register
func Register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required,min=2,max=32"`
		Password string `json:"password" binding:"required,min=6"`
		Email    string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	u := model.User{Username: req.Username, Password: string(hash)}
	if req.Email != "" {
		e := req.Email
		u.Email = &e
	}
	if err := model.DB.Create(&u).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "用户名或邮箱已存在"})
		return
	}
	token, _ := makeToken(u.ID)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": userResponse(u)})
}

// POST /api/auth/login
func Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var u model.User
	if err := model.DB.Where("username = ?", req.Username).First(&u).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	token, _ := makeToken(u.ID)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": userResponse(u)})
}

// GET /api/user/self
func GetSelf(c *gin.Context) {
	var u model.User
	model.DB.First(&u, c.GetUint("user_id"))
	c.JSON(http.StatusOK, userResponse(u))
}

// PUT /api/user/self
func UpdateSelf(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
	}
	c.ShouldBindJSON(&req)
	updates := map[string]interface{}{}
	if req.Username != "" {
		updates["username"] = req.Username
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无更新内容"})
		return
	}
	if err := model.DB.Model(&model.User{}).Where("id = ?", c.GetUint("user_id")).Updates(updates).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "用户名或邮箱已存在"})
		return
	}
	var u model.User
	model.DB.First(&u, c.GetUint("user_id"))
	c.JSON(http.StatusOK, userResponse(u))
}

// 获取当前 user_id 对应的 username（用于接口）
func GetUsernameByID(id uint) string {
	var u model.User
	model.DB.Select("username").First(&u, id)
	return u.Username
}

// 环境变量读取（给其他 handler 用）
func EnvOr(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}
