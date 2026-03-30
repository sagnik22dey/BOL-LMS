package models

import (
	"time"

	"github.com/google/uuid"
)

type Cart struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Items     []CartItem `json:"items"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CartItem struct {
	ID        uuid.UUID `json:"id"`
	CartID    uuid.UUID `json:"cart_id"`
	ItemType  string    `json:"item_type"` // 'course' or 'bundle'
	ItemID    uuid.UUID `json:"item_id"`
	AddedAt   time.Time `json:"added_at"`
	
	// Hydrated fields for frontend
	Price    int    `json:"price,omitempty"`
	Currency string `json:"currency,omitempty"`
	Title    string `json:"title,omitempty"`
}

type Order struct {
	ID          uuid.UUID   `json:"id"`
	UserID      uuid.UUID   `json:"user_id"`
	TotalAmount int         `json:"total_amount"`
	Currency    string      `json:"currency"`
	Status      string      `json:"status"` // 'pending', 'success', 'failed'
	PaymentID   *string     `json:"payment_id,omitempty"`
	Items       []OrderItem `json:"items"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type OrderItem struct {
	ID       uuid.UUID `json:"id"`
	OrderID  uuid.UUID `json:"order_id"`
	ItemType string    `json:"item_type"` // 'course' or 'bundle'
	ItemID   uuid.UUID `json:"item_id"`
	Price    int       `json:"price"`
	Currency string    `json:"currency"`
}

type AddToCartRequest struct {
	ItemType string `json:"item_type" binding:"required,oneof=course bundle"`
	ItemID   string `json:"item_id" binding:"required"`
}

type CheckoutCartRequest struct {
	// For dummy checkout, we might not need any payload
}
