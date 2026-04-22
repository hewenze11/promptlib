package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"promptlib-backend/model"
	"time"

	"github.com/gin-gonic/gin"
)

func getSystemConfig(key string) string {
	var cfg model.SystemConfig
	if err := model.DB.Where("`key` = ?", key).First(&cfg).Error; err != nil {
		return ""
	}
	return cfg.Value
}

// POST /api/ai/polish
func PolishText(c *gin.Context) {
	var req struct {
		Text string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	provider := getSystemConfig("ai_polish_provider")
	if provider == "" {
		provider = "gemini"
	}
	apiKey := getSystemConfig("ai_polish_key")
	if apiKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"error": "AI润色功能未配置，请联系管理员",
			"code":  "NOT_CONFIGURED",
		})
		return
	}

	prompt := fmt.Sprintf(`你是一个专业的文本优化师。将以下结构化的AI提示词文本优化为自然流畅的语言。
要求：保留所有核心指令和关键信息；去除重复、冗余表述；语句简洁清晰；不添加原文没有的内容；直接输出优化后的文本，不要任何解释。

原文：
%s`, req.Text)

	var result string
	var callErr error

	if provider == "gemini" {
		result, callErr = callGemini(apiKey, prompt)
	} else if provider == "deepseek" {
		result, callErr = callDeepSeek(apiKey, prompt)
	} else {
		result, callErr = callGemini(apiKey, prompt)
	}

	if callErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"error": "AI服务暂时不可用，请稍后重试",
			"code":  "SERVICE_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"result": result})
}

func callGemini(apiKey, prompt string) (string, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s", apiKey)
	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
	}
	b, _ := json.Marshal(body)
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("gemini API error: %d %s", resp.StatusCode, string(data))
	}
	var res struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(data, &res); err != nil {
		return "", err
	}
	if len(res.Candidates) == 0 || len(res.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response")
	}
	return res.Candidates[0].Content.Parts[0].Text, nil
}

func callDeepSeek(apiKey, prompt string) (string, error) {
	url := "https://api.deepseek.com/chat/completions"
	body := map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]interface{}{
			{"role": "user", "content": prompt},
		},
	}
	b, _ := json.Marshal(body)
	client := &http.Client{Timeout: 60 * time.Second}
	reqHTTP, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	reqHTTP.Header.Set("Content-Type", "application/json")
	reqHTTP.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := client.Do(reqHTTP)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("deepseek API error: %d %s", resp.StatusCode, string(data))
	}
	var res struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &res); err != nil {
		return "", err
	}
	if len(res.Choices) == 0 {
		return "", fmt.Errorf("empty response")
	}
	return res.Choices[0].Message.Content, nil
}
