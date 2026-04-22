package model

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

type User struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Username  string    `gorm:"uniqueIndex;size:64;not null" json:"username"`
	Password  string    `gorm:"size:256;not null" json:"-"`
	Email     *string   `gorm:"uniqueIndex;size:128" json:"email,omitempty"`
	Role      int       `gorm:"default:1" json:"role"`
	Onboarded bool      `gorm:"default:false" json:"onboarded"`
}

type Library struct {
	ID          string    `gorm:"primarykey;size:36" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	UserID      uint      `gorm:"index;not null" json:"user_id"`
	User        User      `gorm:"foreignKey:UserID" json:"owner,omitempty"`
	Name        string    `gorm:"size:128;not null" json:"name"`
	Slug        string    `gorm:"size:128;not null" json:"slug"`
	Description string    `gorm:"type:text" json:"description"`
	Visibility  string    `gorm:"size:16;default:'private'" json:"visibility"` // private|public|unlisted
	ForkFromID  *string   `gorm:"size:36" json:"fork_from_id,omitempty"`
	StarCount   int       `gorm:"default:0" json:"star_count"`
	ForkCount   int       `gorm:"default:0" json:"fork_count"`
	IsSystem    bool      `gorm:"default:false" json:"is_system"`
	Tags        []LibraryTag `gorm:"foreignKey:LibraryID" json:"tags,omitempty"`
}

type Entry struct {
	ID          string    `gorm:"primarykey;size:36" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	LibraryID   string    `gorm:"index;size:36;not null" json:"library_id"`
	Title       string    `gorm:"size:128;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Color       string    `gorm:"size:16;default:'#7c3aed'" json:"color"`
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
}

type LibraryStar struct {
	UserID    uint      `gorm:"primarykey" json:"user_id"`
	LibraryID string    `gorm:"primarykey;size:36" json:"library_id"`
	CreatedAt time.Time `json:"created_at"`
}

type LibraryTag struct {
	LibraryID string `gorm:"primarykey;size:36" json:"library_id"`
	Tag       string `gorm:"primarykey;size:64" json:"tag"`
}

type UserActiveLib struct {
	UserID    uint   `gorm:"primarykey" json:"user_id"`
	LibraryID string `gorm:"primarykey;size:36" json:"library_id"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
}

type SystemConfig struct {
	Key       string    `gorm:"primaryKey" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

func InitDB() error {
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "root:PromptLib2026!@tcp(127.0.0.1:3307)/promptlib?charset=utf8mb4&parseTime=True&loc=Local"
	}
	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	err = DB.AutoMigrate(&User{}, &Library{}, &Entry{}, &LibraryStar{}, &LibraryTag{}, &UserActiveLib{}, &SystemConfig{})
	if err != nil {
		return err
	}
	log.Println("database initialized")
	return nil
}
