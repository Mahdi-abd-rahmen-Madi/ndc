package main

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthUser struct {
	ID          int64
	Username    string
	Email       string
	IsStaff     bool
	IsSuperuser bool
}

type cachedUserEntry struct {
	user      *AuthUser
	expiresAt time.Time
}

// AuthStore validates DRF tokens and job/notification ownership against PostgreSQL
// with a short-lived in-memory token cache so concurrent WS reconnects avoid DB storms.
type AuthStore struct {
	pool           *pgxpool.Pool
	mu             sync.RWMutex
	tokenCache     map[string]cachedUserEntry
	tokenTTL       time.Duration
	allowedOrigins map[string]struct{}
}

func NewAuthStore(pool *pgxpool.Pool, allowedOriginsCSV string) *AuthStore {
	origins := make(map[string]struct{})
	for _, item := range strings.Split(allowedOriginsCSV, ",") {
		trimmed := strings.TrimSpace(strings.TrimRight(item, "/"))
		if trimmed != "" {
			origins[strings.ToLower(trimmed)] = struct{}{}
		}
	}
	return &AuthStore{
		pool:           pool,
		tokenCache:     make(map[string]cachedUserEntry),
		tokenTTL:       60 * time.Second,
		allowedOrigins: origins,
	}
}

func (a *AuthStore) CheckOrigin(r *http.Request) bool {
	if len(a.allowedOrigins) == 0 {
		return true
	}
	origin := strings.TrimSpace(strings.TrimRight(r.Header.Get("Origin"), "/"))
	if origin == "" {
		return true
	}
	if _, ok := a.allowedOrigins[strings.ToLower(origin)]; ok {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(u.Host)
	return strings.EqualFold(host, r.Host)
}

func (a *AuthStore) AuthenticateToken(ctx context.Context, tokenKey string) (*AuthUser, error) {
	tokenKey = strings.TrimSpace(tokenKey)
	if tokenKey == "" {
		return nil, nil
	}

	now := time.Now()
	a.mu.RLock()
	if entry, ok := a.tokenCache[tokenKey]; ok && now.Before(entry.expiresAt) {
		a.mu.RUnlock()
		return entry.user, nil
	}
	a.mu.RUnlock()

	if a.pool == nil {
		return nil, nil
	}

	var u AuthUser
	err := a.pool.QueryRow(ctx, `
		SELECT u.id, u.username, COALESCE(u.email, ''), u.is_staff, u.is_superuser
		FROM authtoken_token t
		JOIN auth_user u ON u.id = t.user_id
		WHERE t.key = $1 AND u.is_active = TRUE
	`, tokenKey).Scan(&u.ID, &u.Username, &u.Email, &u.IsStaff, &u.IsSuperuser)
	if err == pgx.ErrNoRows {
		a.mu.Lock()
		a.tokenCache[tokenKey] = cachedUserEntry{user: nil, expiresAt: now.Add(10 * time.Second)}
		a.mu.Unlock()
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	if len(a.tokenCache) > 5000 {
		for k, v := range a.tokenCache {
			if now.After(v.expiresAt) {
				delete(a.tokenCache, k)
			}
		}
	}
	a.tokenCache[tokenKey] = cachedUserEntry{user: &u, expiresAt: now.Add(a.tokenTTL)}
	a.mu.Unlock()
	return &u, nil
}

func (a *AuthStore) CanAccessJob(ctx context.Context, user *AuthUser, jobID int64) (bool, error) {
	if user == nil {
		return false, nil
	}
	if user.IsStaff || user.IsSuperuser {
		return true, nil
	}
	if a.pool == nil {
		return false, nil
	}
	var ownerID *int64
	err := a.pool.QueryRow(ctx, `SELECT user_id FROM api_calculationjob WHERE id = $1`, jobID).Scan(&ownerID)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return ownerID != nil && *ownerID == user.ID, nil
}

func (a *AuthStore) MarkNotificationRead(ctx context.Context, notificationID int64, recipientEmail string) (bool, error) {
	if a.pool == nil {
		return false, nil
	}
	tag, err := a.pool.Exec(ctx, `
		UPDATE geodata_notification
		SET is_read = TRUE
		WHERE id = $1 AND recipient_email = $2
	`, notificationID, recipientEmail)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}
