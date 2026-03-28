package ws

import (
	"encoding/json"
	"log"
	"sync"
)

type Hub struct {
	// Registered clients, grouped by ModuleID
	modules    map[string]map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	mu         sync.Mutex
}

type Message struct {
	ModuleID string          `json:"module_id"`
	Type     string          `json:"type"` // "new_comment"
	Data     json.RawMessage `json:"data"`
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		modules:    make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.modules[client.ModuleID] == nil {
				h.modules[client.ModuleID] = make(map[*Client]bool)
			}
			h.modules[client.ModuleID][client] = true
			h.mu.Unlock()
			log.Printf("Client registered for module %s", client.ModuleID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.modules[client.ModuleID]; ok {
				if _, ok := h.modules[client.ModuleID][client]; ok {
					delete(h.modules[client.ModuleID], client)
					close(client.Send)
					if len(h.modules[client.ModuleID]) == 0 {
						delete(h.modules, client.ModuleID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client unregistered from module %s", client.ModuleID)

		case message := <-h.broadcast:
			h.mu.Lock()
			clients := h.modules[message.ModuleID]
			for client := range clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.modules[message.ModuleID], client)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) Broadcast(msg Message) {
	h.broadcast <- msg
}
