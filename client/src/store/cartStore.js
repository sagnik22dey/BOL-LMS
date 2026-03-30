import { create } from 'zustand';
import axios from '../api/axios';

const useCartStore = create((set, get) => ({
  cart: { items: [] },
  loading: false,
  error: null,

  fetchCart: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get('/api/payments/cart');
      set({ cart: response.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch cart', loading: false });
    }
  },

  addToCart: async (itemType, itemId) => {
    set({ loading: true, error: null });
    try {
      await axios.post('/api/payments/cart', {
        item_type: itemType,
        item_id: itemId
      });
      await get().fetchCart();
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to add item to cart', loading: false });
    }
  },

  removeFromCart: async (itemId) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`/api/payments/cart/${itemId}`);
      await get().fetchCart();
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to remove item', loading: false });
    }
  },

  clearCart: async () => {
    set({ loading: true, error: null });
    try {
      await axios.delete('/api/payments/cart');
      set({ cart: { items: [] }, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to clear cart', loading: false });
    }
  },

  dummyCheckout: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post('/api/payments/checkout/dummy');
      set({ cart: { items: [] }, loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Checkout failed', loading: false });
      throw error;
    }
  }
}));

export default useCartStore;
