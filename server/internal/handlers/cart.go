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

	rows, err := db.Pool.Query(ctx, `SELECT id, item_type, item_id, added_at FROM cart_items WHERE cart_id=$1`, cartID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ci models.CartItem
			ci.CartID = cartID
			if err := rows.Scan(&ci.ID, &ci.ItemType, &ci.ItemID, &ci.AddedAt); err == nil {
				if ci.ItemType == "course" {
					db.Pool.QueryRow(ctx, `SELECT title, price, currency FROM courses WHERE id=$1`, ci.ItemID).Scan(&ci.Title, &ci.Price, &ci.Currency)
				} else if ci.ItemType == "bundle" {
					db.Pool.QueryRow(ctx, `SELECT name, price, currency FROM course_bundles WHERE id=$1`, ci.ItemID).Scan(&ci.Title, &ci.Price, &ci.Currency)
				}
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

	db.Pool.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID)
	c.JSON(http.StatusOK, gin.H{"message": "cart cleared"})
}
