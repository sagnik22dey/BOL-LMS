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

	var orderItems []models.OrderItem
	totalAmount := 0
	currency := "INR" // Fallback, could be dynamic

	for rows.Next() {
		var ci models.OrderItem
		var ciID uuid.UUID
		if err := rows.Scan(&ciID, &ci.ItemType, &ci.ItemID); err == nil {
			var price int
			var curr string
			if ci.ItemType == "course" {
				db.Pool.QueryRow(ctx, `SELECT price, currency FROM courses WHERE id=$1`, ci.ItemID).Scan(&price, &curr)
			} else if ci.ItemType == "bundle" {
				db.Pool.QueryRow(ctx, `SELECT price, currency FROM course_bundles WHERE id=$1`, ci.ItemID).Scan(&price, &curr)
			}
			ci.Price = price
			ci.Currency = curr
			ci.OrderID = uuid.Nil // placeholder
			ci.ID = uuid.New()
			orderItems = append(orderItems, ci)
			totalAmount += price
			if curr != "" {
				currency = curr
			}
		}
	}

	if len(orderItems) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cart is empty"})
		return
	}

	// 2. Create the order
	orderID := uuid.New()
	_, err = db.Pool.Exec(ctx, 
		`INSERT INTO orders (id, user_id, total_amount, currency, status, payment_id) VALUES ($1, $2, $3, $4, 'success', 'dummy_payment_id')`,
		orderID, userID, totalAmount, currency,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create order"})
		return
	}

	// 3. Insert order items & auto-assign
	for _, item := range orderItems {
		db.Pool.Exec(ctx,
			`INSERT INTO order_items (id, order_id, item_type, item_id, price, currency) VALUES ($1, $2, $3, $4, $5, $6)`,
			item.ID, orderID, item.ItemType, item.ItemID, item.Price, item.Currency,
		)

		if item.ItemType == "course" {
			db.Pool.Exec(ctx,
				`INSERT INTO user_course_assignments (id, user_id, course_id, assigned_by, assigned_at)
				 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, course_id) DO NOTHING`,
				uuid.New(), userID, item.ItemID, userID, time.Now(),
			)
		} else if item.ItemType == "bundle" {
			db.Pool.Exec(ctx,
				`INSERT INTO course_bundle_users (bundle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				item.ItemID, userID,
			)
		}
	}

	// 4. Clear the cart
	db.Pool.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID)

	c.JSON(http.StatusOK, gin.H{
		"message": "checkout successful",
		"order_id": orderID,
	})
}
