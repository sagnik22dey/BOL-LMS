package handlers

import (
	"context"
	"net/http"
	"time"

	"bol-lms-server/internal/db"
	"bol-lms-server/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func DummyCheckout(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Get the current cart
	cartID, err := getOrCreateCart(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch cart"})
		return
	}

	rows, err := db.Pool.Query(ctx, `SELECT id, item_type, item_id FROM cart_items WHERE cart_id=$1`, cartID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch cart items"})
		return
	}
	defer rows.Close()

	// BL-005: Collect all cart items before opening the transaction, so we can
	// validate the cart is non-empty before any writes.
	type rawCartItem struct {
		id       uuid.UUID
		itemType string
		itemID   uuid.UUID
	}
	var rawItems []rawCartItem
	for rows.Next() {
		var ci rawCartItem
		if err := rows.Scan(&ci.id, &ci.itemType, &ci.itemID); err == nil {
			rawItems = append(rawItems, ci)
		}
	}
	rows.Close()

	if len(rawItems) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cart is empty"})
		return
	}

	// 2. Resolve prices for each item (outside transaction — read-only)
	var orderItems []models.OrderItem
	totalAmount := 0
	currency := "INR"

	for _, ci := range rawItems {
		var price int
		var curr string
		if ci.itemType == "course" {
			db.Pool.QueryRow(ctx, `SELECT price, currency FROM courses WHERE id=$1`, ci.itemID).Scan(&price, &curr)
		} else if ci.itemType == "bundle" {
			db.Pool.QueryRow(ctx, `SELECT price, currency FROM course_bundles WHERE id=$1`, ci.itemID).Scan(&price, &curr)
		}
		item := models.OrderItem{
			ID:       uuid.New(),
			ItemType: ci.itemType,
			ItemID:   ci.itemID,
			Price:    price,
			Currency: curr,
		}
		orderItems = append(orderItems, item)
		totalAmount += price
		if curr != "" {
			currency = curr
		}
	}

	// BL-005: Wrap all writes in a single DB transaction.
	// If any write fails, all changes are rolled back atomically.
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not begin transaction"})
		return
	}
	defer tx.Rollback(ctx) // no-op if tx.Commit() has already been called

	// 3. Create the order
	orderID := uuid.New()
	if _, err = tx.Exec(ctx,
		`INSERT INTO orders (id, user_id, total_amount, currency, status, payment_id) VALUES ($1, $2, $3, $4, 'success', 'dummy_payment_id')`,
		orderID, userID, totalAmount, currency,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create order"})
		return
	}

	// 4. Insert order items & auto-assign within the same transaction
	for _, item := range orderItems {
		item.OrderID = orderID
		if _, err = tx.Exec(ctx,
			`INSERT INTO order_items (id, order_id, item_type, item_id, price, currency) VALUES ($1, $2, $3, $4, $5, $6)`,
			item.ID, orderID, item.ItemType, item.ItemID, item.Price, item.Currency,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not insert order item"})
			return
		}

		if item.ItemType == "course" {
			if _, err = tx.Exec(ctx,
				`INSERT INTO user_course_assignments (id, user_id, course_id, assigned_by, assigned_at)
				 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, course_id) DO NOTHING`,
				uuid.New(), userID, item.ItemID, userID, time.Now(),
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign course"})
				return
			}
		} else if item.ItemType == "bundle" {
			if _, err = tx.Exec(ctx,
				`INSERT INTO course_bundle_users (bundle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				item.ItemID, userID,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "could not assign bundle"})
				return
			}
		}
	}

	// 5. Clear the cart within the same transaction
	if _, err = tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not clear cart"})
		return
	}

	// 6. Commit — all-or-nothing
	if err = tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "checkout failed: could not commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "checkout successful",
		"order_id": orderID,
	})
}
