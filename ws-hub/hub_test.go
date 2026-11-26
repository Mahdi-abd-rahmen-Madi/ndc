package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHubSubscribePublishAndEvictSlowClient(t *testing.T) {
	hub := NewHub()

	c1 := &Client{hub: hub, group: "calc_7", send: make(chan []byte, 2)}
	c2 := &Client{hub: hub, group: "calc_7", send: make(chan []byte, 1)}
	hub.Subscribe(c1)
	hub.Subscribe(c2)

	conns, groups := hub.Stats()
	if conns != 2 || groups != 1 {
		t.Fatalf("expected 2 conns in 1 group, got %d conns in %d groups", conns, groups)
	}

	delivered := hub.Publish("calc_7", []byte(`{"percent":50}`))
	if delivered != 2 {
		t.Fatalf("expected 2 deliveries, got %d", delivered)
	}
	if msg := string(<-c1.send); msg != `{"percent":50}` {
		t.Fatalf("unexpected c1 msg: %s", msg)
	}

	// Fill c2 buffer (size 1) without reading, then publish again -> c2 evicted
	_ = hub.Publish("calc_7", []byte(`{"percent":60}`))
	<-c1.send

	delivered = hub.Publish("calc_7", []byte(`{"percent":70}`))
	if delivered != 1 {
		t.Fatalf("expected 1 delivery after slow client eviction, got %d", delivered)
	}
	conns, _ = hub.Stats()
	if conns != 1 {
		t.Fatalf("expected 1 conn remaining, got %d", conns)
	}
	hub.Unsubscribe(c1)
}

func TestInternalPublishSecretAndWorkerStatusStore(t *testing.T) {
	hub := NewHub()
	workerStore := NewWorkerStatusStore("")
	srv := NewServer(hub, NewAuthStore(nil, ""), workerStore, "super-secret")
	ts := httptest.NewServer(srv.Routes())
	defer ts.Close()

	// Subscribe dummy client to worker_status
	c := &Client{hub: hub, group: "worker_status", send: make(chan []byte, 4)}
	hub.Subscribe(c)
	defer hub.Unsubscribe(c)

	body := `{"group":"worker_status","payload":{"type":"worker_status","state":"busy","active_jobs":1,"queue_size":3,"total_ahead":4,"source":"worker"}}`

	// Reject missing/bad secret
	reqBad, _ := http.NewRequest(http.MethodPost, ts.URL+"/internal/publish", bytes.NewBufferString(body))
	reqBad.Header.Set("X-Hub-Secret", "wrong")
	respBad, err := http.DefaultClient.Do(reqBad)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	_ = respBad.Body.Close()
	if respBad.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for bad secret, got %d", respBad.StatusCode)
	}

	// Accept valid secret and update WorkerStatusStore
	reqOK, _ := http.NewRequest(http.MethodPost, ts.URL+"/internal/publish", bytes.NewBufferString(body))
	reqOK.Header.Set("X-Hub-Secret", "super-secret")
	respOK, err := http.DefaultClient.Do(reqOK)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	_ = respOK.Body.Close()
	if respOK.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respOK.StatusCode)
	}

	select {
	case raw := <-c.send:
		var got map[string]any
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("invalid json broadcast: %v", err)
		}
		if got["state"] != "busy" {
			t.Fatalf("expected state=busy, got %v", got["state"])
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for broadcast")
	}

	cached := workerStore.GetOrProbe(false)
	if cached.State != "busy" || cached.QueueSize != 3 || cached.TotalAhead != 4 {
		t.Fatalf("unexpected cached worker status: %+v", cached)
	}
}

func TestNormalizeWorkerStateAndPayload(t *testing.T) {
	if got := NormalizeWorkerState("IDLE", nil); got != "available" {
		t.Fatalf("expected available, got %s", got)
	}
	if got := NormalizeWorkerState("IDLE", 42); got != "busy" {
		t.Fatalf("expected busy when job id present, got %s", got)
	}
	if got := NormalizeWorkerState("OFFLINE", 42); got != "offline" {
		t.Fatalf("expected offline, got %s", got)
	}
	p := BuildWorkerStatusPayload("offline", 5, nil, "probe")
	if p.QueueSize != 0 || p.TotalAhead != 0 || p.ActiveJobs != 0 {
		t.Fatalf("offline payload should zero counts, got %+v", p)
	}
}
