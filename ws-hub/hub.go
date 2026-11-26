package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 64 * 1024
	sendBufSize    = 64
)

// Client represents a single authenticated WebSocket connection subscribed to one group.
type Client struct {
	hub   *Hub
	conn  *websocket.Conn
	group string
	send  chan []byte
}

// Hub maintains active WebSocket groups and broadcasts JSON messages without Redis.
type Hub struct {
	mu     sync.RWMutex
	groups map[string]map[*Client]struct{}
	total  int
}

func NewHub() *Hub {
	return &Hub{
		groups: make(map[string]map[*Client]struct{}),
	}
}

func (h *Hub) Subscribe(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	peers, ok := h.groups[c.group]
	if !ok {
		peers = make(map[*Client]struct{})
		h.groups[c.group] = peers
	}
	peers[c] = struct{}{}
	h.total++
}

func (h *Hub) Unsubscribe(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	peers, ok := h.groups[c.group]
	if !ok {
		return
	}
	if _, exists := peers[c]; exists {
		delete(peers, c)
		close(c.send)
		h.total--
		if len(peers) == 0 {
			delete(h.groups, c.group)
		}
	}
}

// Publish fans out raw JSON bytes to every client currently subscribed to group.
// Slow consumers whose send buffer is full are dropped so they never block other clients.
func (h *Hub) Publish(group string, raw []byte) int {
	h.mu.RLock()
	peers := h.groups[group]
	if len(peers) == 0 {
		h.mu.RUnlock()
		return 0
	}
	snapshot := make([]*Client, 0, len(peers))
	for c := range peers {
		snapshot = append(snapshot, c)
	}
	h.mu.RUnlock()

	delivered := 0
	var slow []*Client
	for _, c := range snapshot {
		select {
		case c.send <- raw:
			delivered++
		default:
			slow = append(slow, c)
		}
	}
	for _, c := range slow {
		log.Printf("evicting slow websocket client from group=%s", group)
		h.Unsubscribe(c)
		if c.conn != nil {
			_ = c.conn.Close()
		}
	}
	return delivered
}

func (h *Hub) Stats() (connections int, groups int) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.total, len(h.groups)
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump(onMessage func([]byte)) {
	defer func() {
		c.hub.Unsubscribe(c)
		_ = c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		if onMessage != nil {
			onMessage(message)
		}
	}
}

// WorkerStatusPayload mirrors backend/api/worker_status.py build_status_payload.
type WorkerStatusPayload struct {
	Type           string  `json:"type"`
	State          string  `json:"state"`
	ActiveJobs     int     `json:"active_jobs"`
	QueueSize      int     `json:"queue_size"`
	TotalAhead     int     `json:"total_ahead"`
	CurrentJobType *string `json:"current_job_type"`
	Source         string  `json:"source"`
	UpdatedAt      string  `json:"updated_at"`
}

// WorkerStatusStore caches the live Robot Worker status in Go memory and coordinates
// single-flight cold-start probes to ROBOT_WORKER_STATUS_URL.
type WorkerStatusStore struct {
	mu        sync.RWMutex
	probeMu   sync.Mutex
	current   *WorkerStatusPayload
	statusURL string
	httpCli   *http.Client
}

func NewWorkerStatusStore(statusURL string) *WorkerStatusStore {
	return &WorkerStatusStore{
		statusURL: strings.TrimSpace(statusURL),
		httpCli:   &http.Client{Timeout: 2500 * time.Millisecond},
	}
}

func NormalizeWorkerState(rawStatus string, currentJobID any) string {
	token := strings.ToUpper(strings.TrimSpace(rawStatus))
	switch token {
	case "OFFLINE", "DOWN", "STOPPED", "UNREACHABLE":
		return "offline"
	case "BUSY", "RUNNING", "PROCESSING", "WORKING":
		return "busy"
	case "IDLE", "AVAILABLE", "READY", "ONLINE":
		if currentJobID != nil && currentJobID != "" && currentJobID != float64(0) {
			return "busy"
		}
		return "available"
	default:
		if currentJobID != nil && currentJobID != "" && currentJobID != float64(0) {
			return "busy"
		}
		return "available"
	}
}

func BuildWorkerStatusPayload(state string, queueSize int, currentJobType *string, source string) WorkerStatusPayload {
	if queueSize < 0 {
		queueSize = 0
	}
	activeJobs := 0
	if state == "busy" {
		activeJobs = 1
	}
	safeQueue := queueSize
	totalAhead := activeJobs + safeQueue
	var jobType *string
	if state == "busy" {
		jobType = currentJobType
	} else {
		safeQueue = 0
		totalAhead = 0
	}
	return WorkerStatusPayload{
		Type:           "worker_status",
		State:          state,
		ActiveJobs:     activeJobs,
		QueueSize:      safeQueue,
		TotalAhead:     totalAhead,
		CurrentJobType: jobType,
		Source:         source,
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
	}
}

func (s *WorkerStatusStore) SetFromRawJSON(raw []byte) {
	var parsed WorkerStatusPayload
	if err := json.Unmarshal(raw, &parsed); err != nil || parsed.State == "" {
		return
	}
	parsed.Type = "worker_status"
	s.mu.Lock()
	s.current = &parsed
	s.mu.Unlock()
}

func (s *WorkerStatusStore) Set(payload WorkerStatusPayload) {
	payload.Type = "worker_status"
	s.mu.Lock()
	s.current = &payload
	s.mu.Unlock()
}

func (s *WorkerStatusStore) GetOrProbe(force bool) WorkerStatusPayload {
	if !force {
		s.mu.RLock()
		cur := s.current
		s.mu.RUnlock()
		if cur != nil && (cur.State == "available" || cur.State == "busy" || cur.State == "offline") {
			return *cur
		}
	}

	s.probeMu.Lock()
	defer s.probeMu.Unlock()

	if !force {
		s.mu.RLock()
		cur := s.current
		s.mu.RUnlock()
		if cur != nil {
			return *cur
		}
	}

	payload := s.probeOnce()
	s.Set(payload)
	return payload
}

func (s *WorkerStatusStore) probeOnce() WorkerStatusPayload {
	if s.statusURL == "" {
		return BuildWorkerStatusPayload("offline", 0, nil, "probe")
	}
	resp, err := s.httpCli.Get(s.statusURL)
	if err != nil {
		log.Printf("worker status probe failed (%s): %v", s.statusURL, err)
		return BuildWorkerStatusPayload("offline", 0, nil, "probe")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("worker status probe HTTP %d from %s", resp.StatusCode, s.statusURL)
		return BuildWorkerStatusPayload("offline", 0, nil, "probe")
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return BuildWorkerStatusPayload("offline", 0, nil, "probe")
	}
	var raw struct {
		Status         string  `json:"status"`
		QueueSize      int     `json:"queue_size"`
		CurrentJobType *string `json:"current_job_type"`
		CurrentJobID   any     `json:"current_job_id"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return BuildWorkerStatusPayload("offline", 0, nil, "probe")
	}
	state := NormalizeWorkerState(raw.Status, raw.CurrentJobID)
	return BuildWorkerStatusPayload(state, raw.QueueSize, raw.CurrentJobType, "probe")
}
