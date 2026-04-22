package handler

import (
	"net/http"
	"os"
	"promptlib-backend/middleware"
	"promptlib-backend/model"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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

// createOnboardingLibrary 为新用户创建系统使用手册词库
func createOnboardingLibrary(userID uint) {
	lib := model.Library{
		ID:         uuid.New().String(),
		UserID:     userID,
		Name:       "PromptLib 使用手册",
		Slug:       "promptlib-guide",
		Visibility: "public",
		IsSystem:   true,
	}
	if err := model.DB.Create(&lib).Error; err != nil {
		return
	}

	entries := []struct {
		Title       string
		Description string
	}{
		// 编辑器功能
		{"@ 引用词条", "在编辑框输入 @ 符号可搜索并引用词条。引用后生成富文本时，词条内容自动展开为完整描述。多个激活词库的词条同时可搜索。"},
		{"生成富文本", "点击工具栏「生成」按钮，编辑框内所有 @ 引用的词条将自动展开为详细描述，生成完整的结构化文本，可直接复制给 AI 使用。"},
		{"AI 润色", "点击「AI 润色」按钮，对生成的富文本进行智能压缩优化：去除冗余表述，保留核心语义，让文本更简洁清晰，同时节省 token 用量。需配置 AI API Key 后可用。"},
		{"阅读模式", "点击工具栏「阅读模式」切换视图。阅读模式下鼠标悬停词条显示详情卡片，点击词条跳转到词条详情页。"},
		{"加载外部词库", "在编辑器页面可粘贴任意公开词库的链接（格式：/@用户名/slug），临时加载该词库的词条到编辑器 @ 候选列表，无需登录，用完即走。"},
		// 词库管理
		{"新建词库", "点击词库列表底部「+ 新建词库」，填写名称和可见性（公开/私有）。公开词库可被所有人搜索和 Fork，私有词库仅自己可见。"},
		{"删除词库", "在词库管理页点击词库右侧菜单，选择「删除词库」。删除前需二次确认，删除后词库及所有词条不可恢复。"},
		{"分享词库", "公开词库拥有全网唯一的分享链接（格式：/@用户名/slug），可直接分享给他人。对方可预览词库内容并一键 Fork 到自己账号。"},
		{"Fork 词库", "在公开词库页点击「Fork」，将该词库完整复制到你的账号下成为独立副本，可自由修改，不影响原词库。"},
		{"导入 / 导出词库", "在词库管理页可将词库导出为 JSON 文件备份，也可从 JSON 文件导入恢复。适合迁移数据或在不同账号间复制词库。"},
		// 协作与发现
		{"发现页", "点击顶部导航「发现」，可浏览全站公开词库，按标签筛选，查看热门词库和最新词库。"},
		{"星标收藏", "在发现页或词库详情页点击「⭐ 收藏」，将感兴趣的公开词库加入收藏。收藏不会复制词库内容，只是保存引用。"},
		{"用户主页", "每个用户拥有公开主页（格式：/@用户名），展示该用户所有公开词库。"},
		{"词库引用格式", "在编辑器中引用词条时，无冲突显示「@词条名」，多个激活词库存在同名词条时显示「@词库名.词条名」以区分来源。"},
	}

	for i, e := range entries {
		entry := model.Entry{
			ID:          uuid.New().String(),
			LibraryID:   lib.ID,
			Title:       e.Title,
			Description: e.Description,
			SortOrder:   i,
		}
		model.DB.Create(&entry)
	}
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
	// 自动创建使用手册词库
	go createOnboardingLibrary(u.ID)
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
