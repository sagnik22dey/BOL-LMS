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

func getOrCreateCart(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	var cartID uuid.UUID
	err := db.Pool.QueryRow(ctx, `SELECT id FROM carts WHERE user_id=$1`, userID).Scan(&cartID)
	if err != nil {
		cartID = uuid.New()
		_, err = db.Pool.Exec(ctx, `INSERT INTO carts (id, user_id) VALUES ($1, $2)`, cartID, userID)
		if err != nil {
			return uuid.Nil, err
		}
	}
	return cartID, nil
}

func GetCart(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cartID, err := getOrCreateCart(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch cart"})
		return
	}

	cart := models.Cart{ID: cartID, UserID: userID, Items: []models.CartItem{}}

	// PERF-001: Replace N+1 per-item queries with a single JOIN across courses and bundles.
	rows, err := db.Pool.Query(ctx, `
		SELECT ci.id, ci.item_type, ci.item_id, ci.added_at,
		       COALESCE(c.title, cb.name, '') AS title,
		       COALESCE(c.price, cb.price, 0) AS price,
		       COALESCE(c.currency, cb.currency, 'INR') AS currency
		FROM cart_items ci
		LEFT JOIN courses c ON ci.item_type = 'course' AND ci.item_id = c.id
		LEFT JOIN course_bundles cb ON ci.item_type = 'bundle' AND ci.item_id = cb.id
		WHERE ci.cart_id = $1`, cartID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ci models.CartItem
			ci.CartID = cartID
			if err := rows.Scan(&ci.ID, &ci.ItemType, &ci.ItemID, &ci.AddedAt, &ci.Title, &ci.Price, &ci.Currency); err == nil {
				cart.Items = append(cart.Items, ci)
			}
		}
	}
	c.JSON(http.StatusOK, cart)
}

func AddToCart(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req models.AddToCartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// SEC-005: Validate that item_type is one of the known valid types.
	// Prevents arbitrary strings being stored in the database.
	if req.ItemType != "course" && req.ItemType != "bundle" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item type: must be 'course' or 'bundle'"})
		return
	}

	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cartID, err := getOrCreateCart(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not get cart"})
		return
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO cart_items (id, cart_id, item_type, item_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
		uuid.New(), cartID, req.ItemType, itemID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add item to cart"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "item added to cart"})
}

func RemoveFromCart(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	itemID, err := uuid.Parse(c.Param("itemId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cartID, err := getOrCreateCart(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not get cart"})
		return
	}

	_, err = db.Pool.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1 AND item_id=$2`, cartID, itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "item removed"})
}

func ClearCart(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cartID, err := getOrCreateCart(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not get cart"})
		return
	}

	// QUAL-001: Handle the DB error instead of silently ignoring it.
	if _, err := db.Pool.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not clear cart"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "cart cleared"})
}
