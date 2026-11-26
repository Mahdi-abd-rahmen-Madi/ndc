package main

import (
	"context"
	"crypto/md5"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type Server struct {
	hub         *Hub
	auth        *AuthStore
	workerStore *WorkerStatusStore
	hubSecret   string
	upgrader    websocket.Upgrader
}

func NewServer(hub *Hub, auth *AuthStore, workerStore *WorkerStatusStore, hubSecret string) *Server {
	s := &Server{
		hub:         hub,
		auth:        auth,
		workerStore: workerStore,
		hubSecret:   hubSecret,
	}
	s.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 4096,
		CheckOrigin: func(r *http.Request) bool {
			if s.auth == nil {
				return true
			}
			return s.auth.CheckOrigin(r)
		},
	}
	return s
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/internal/publish", s.handleInternalPublish)
	mux.HandleFunc("/ws/calculations/", s.handleCalculationWS)
	mux.HandleFunc("/ws/worker/status/", s.handleWorkerStatusWS)
	mux.HandleFunc("/ws/notifications/", s.handleNotificationsWS)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	conns, groups := s.hub.Stats()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":      "ok",
		"connections": conns,
		"groups":      groups,
	})
}

func (s *Server) handleInternalPublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.hubSecret != "" {
		provided := r.Header.Get("X-Hub-Secret")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(s.hubSecret)) != 1 {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}

	var req struct {
		Group   string          `json:"group"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(body, &req); err != nil || strings.TrimSpace(req.Group) == "" || len(req.Payload) == 0 {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}

	if req.Group == "worker_status" && s.workerStore != nil {
		s.workerStore.SetFromRawJSON(req.Payload)
	}

	delivered := s.hub.Publish(req.Group, req.Payload)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    "ok",
		"group":     req.Group,
		"delivered": delivered,
	})
}

func (s *Server) closeWithCode(conn *websocket.Conn, code int, reason string) {
	_ = conn.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(code, reason),
		time.Now().Add(2*time.Second),
	)
	_ = conn.Close()
}

func (s *Server) authenticateRequest(r *http.Request) (*AuthUser, error) {
	tokenKey := r.URL.Query().Get("token")
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	return s.auth.AuthenticateToken(ctx, tokenKey)
}

func (s *Server) handleCalculationWS(w http.ResponseWriter, r *http.Request) {
	rawID := strings.TrimPrefix(r.URL.Path, "/ws/calculations/")
	rawID = strings.TrimSuffix(rawID, "/")
	if rawID == "" || strings.Contains(rawID, "/") {
		http.NotFound(w, r)
		return
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	jobID, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || jobID <= 0 {
		s.closeWithCode(conn, 4400, "invalid job id")
		return
	}

	user, err := s.authenticateRequest(r)
	if err != nil {
		log.Printf("auth lookup error for calc ws job=%d: %v", jobID, err)
		s.closeWithCode(conn, 4403, "auth error")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	allowed, err := s.auth.CanAccessJob(ctx, user, jobID)
	cancel()
	if err != nil || !allowed {
		s.closeWithCode(conn, 4403, "forbidden")
		return
	}

	client := &Client{
		hub:   s.hub,
		conn:  conn,
		group: fmt.Sprintf("calc_%d", jobID),
		send:  make(chan []byte, sendBufSize),
	}
	s.hub.Subscribe(client)

	ack, _ := json.Marshal(map[string]any{
		"type":    "connected",
		"job_id":  jobID,
		"message": fmt.Sprintf("Connecté au canal de suivi du job #%d", jobID),
	})
	client.send <- ack

	go client.writePump()
	client.readPump(nil)
}

func (s *Server) handleWorkerStatusWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	user, err := s.authenticateRequest(r)
	if err != nil || user == nil {
		s.closeWithCode(conn, 4403, "forbidden")
		return
	}

	client := &Client{
		hub:   s.hub,
		conn:  conn,
		group: "worker_status",
		send:  make(chan []byte, sendBufSize),
	}
	s.hub.Subscribe(client)

	initial := s.workerStore.GetOrProbe(false)
	if raw, err := json.Marshal(initial); err == nil {
		client.send <- raw
	}

	go client.writePump()
	client.readPump(func(msg []byte) {
		var action struct {
			Action string `json:"action"`
		}
		if err := json.Unmarshal(msg, &action); err == nil && action.Action == "refresh" {
			refreshed := s.workerStore.GetOrProbe(true)
			if raw, err := json.Marshal(refreshed); err == nil {
				s.hub.Publish("worker_status", raw)
			}
		}
	})
}

func (s *Server) handleNotificationsWS(w http.ResponseWriter, r *http.Request) {
	rawEmail := strings.TrimPrefix(r.URL.Path, "/ws/notifications/")
	rawEmail = strings.TrimSuffix(rawEmail, "/")
	if rawEmail == "" || strings.Contains(rawEmail, "/") {
		http.NotFound(w, r)
		return
	}
	decodedEmail, err := url.PathUnescape(rawEmail)
	if err != nil {
		decodedEmail = rawEmail
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	user, err := s.authenticateRequest(r)
	if err != nil || user == nil {
		s.closeWithCode(conn, 4401, "unauthorized")
		return
	}

	target := strings.ToLower(strings.TrimSpace(decodedEmail))
	userEmail := strings.ToLower(strings.TrimSpace(user.Email))
	userName := strings.ToLower(strings.TrimSpace(user.Username))
	if !user.IsStaff && !user.IsSuperuser && target != userEmail && target != userName {
		s.closeWithCode(conn, 4403, "forbidden")
		return
	}

	sum := md5.Sum([]byte(decodedEmail))
	groupName := "notifications_" + hex.EncodeToString(sum[:])

	client := &Client{
		hub:   s.hub,
		conn:  conn,
		group: groupName,
		send:  make(chan []byte, sendBufSize),
	}
	s.hub.Subscribe(client)

	ack, _ := json.Marshal(map[string]any{
		"type":    "connection_established",
		"message": "Connecté aux notifications en temps réel",
	})
	client.send <- ack

	go client.writePump()
	client.readPump(func(msg []byte) {
		var req struct {
			Type           string `json:"type"`
			NotificationID int64  `json:"notification_id"`
		}
		if err := json.Unmarshal(msg, &req); err != nil || req.Type != "mark_read" || req.NotificationID <= 0 {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		ok, err := s.auth.MarkNotificationRead(ctx, req.NotificationID, decodedEmail)
		cancel()
		if err != nil {
			log.Printf("mark_read error for notification=%d: %v", req.NotificationID, err)
			ok = false
		}
		resp, _ := json.Marshal(map[string]any{
			"type":            "read_confirmed",
			"notification_id": req.NotificationID,
			"success":         ok,
		})
		select {
		case client.send <- resp:
		default:
		}
	})
}
