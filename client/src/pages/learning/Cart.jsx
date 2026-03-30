import React, { useEffect, useState } from 'react';
import useCartStore from '../../store/cartStore';
import { useNavigate } from 'react-router-dom';

const Cart = () => {
  const { cart, fetchCart, removeFromCart, clearCart, dummyCheckout, loading, error } = useCartStore();
  const navigate = useNavigate();
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleCheckout = async () => {
    try {
      await dummyCheckout();
      setCheckoutSuccess(true);
      setTimeout(() => {
        navigate('/dashboard/learning');
      }, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const totalAmount = cart?.items?.reduce((acc, item) => acc + (item.price || 0), 0) || 0;
  const currency = cart?.items?.[0]?.currency || 'INR';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-primary font-headline">Your Cart</h1>
        <p className="text-on-surface-variant text-sm mt-1">Review your items before checkout</p>
      </div>

      {error && <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm">{error}</div>}

      {checkoutSuccess ? (
        <div className="bg-[#e8f5e9] border border-[#c8e6c9] text-[#2e7d32] p-8 rounded-2xl text-center space-y-4">
          <span className="material-symbols-outlined text-5xl">check_circle</span>
          <h2 className="text-2xl font-bold font-headline">Purchase Successful!</h2>
          <p>Your courses have been assigned. Redirecting to My Learning...</p>
        </div>
      ) : cart?.items?.length === 0 ? (
        <div className="bg-surface-container-lowest border border-surface-dim rounded-3xl p-16 text-center shadow-sm">
          <span className="material-symbols-outlined text-6xl text-outline opacity-50 mb-4 block">shopping_cart</span>
          <h3 className="text-xl font-extrabold font-headline text-on-surface mb-2">Your cart is empty</h3>
          <p className="text-on-surface-variant font-body mb-6">Browse courses and add them to your cart to purchase.</p>
          <button onClick={() => navigate('/dashboard/courses')} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold">
            Browse Courses
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Items ({cart?.items?.length})</h2>
              <button 
                onClick={clearCart} 
                disabled={loading}
                className="text-sm text-error font-semibold hover:underline"
              >
                Clear Cart
              </button>
            </div>
            
            <div className="divide-y divide-surface-dim border border-surface-dim rounded-2xl overflow-hidden bg-surface-container-lowest">
              {cart?.items?.map((item) => (
                <div key={item.id} className="p-4 flex gap-4 items-center">
                  <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined">{item.item_type === 'course' ? 'school' : 'library_books'}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase font-bold tracking-wider text-primary mb-1">{item.item_type}</div>
                    <h3 className="font-bold text-on-surface">{item.title}</h3>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{item.price > 0 ? `${item.currency} ${item.price}` : 'Free'}</p>
                    <button 
                      onClick={() => removeFromCart(item.item_id)}
                      disabled={loading}
                      className="text-xs text-on-surface-variant hover:text-error mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-80">
            <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-dim shadow-sm sticky top-24">
              <h3 className="font-bold text-lg mb-4">Order Summary</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="font-medium">{totalAmount > 0 ? `${currency} ${totalAmount}` : 'Free'}</span>
              </div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-on-surface-variant">Tax</span>
                <span className="font-medium">Calculated at checkout</span>
              </div>
              
              <div className="border-t border-surface-dim pt-4 mb-6 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-extrabold text-2xl text-primary">{totalAmount > 0 ? `${currency} ${totalAmount}` : 'Free'}</span>
              </div>

              <button 
                onClick={handleCheckout} 
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-on-primary-fixed-variant transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Complete Purchase'}
              </button>
              
              <p className="text-xs text-center text-on-surface-variant mt-4">
                By completing your purchase, you agree to our Terms of Service.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
