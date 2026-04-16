require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(express.json());
app.use(cors());

app.post('/get-shipping-rates', async (req, res) => {
  try {
    const { items } = req.body;
    const rates = [
      { id: 'shr_standard_15', label: 'Standard Ground', price: 15.00, date: '5-7 Business Days' },
      { id: 'shr_express_35', label: 'Express Priority', price: 35.00, date: '2-3 Business Days' }
    ];
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate shipping' });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items, email, shipping, orderId } = req.body;

    const line_items = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name.replace(/<[^>]*>?/gm, ''),
          images: [item.imageUrl], 
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: 1,
    }));

    if (shipping > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping & Handling' },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: email,
      automatic_tax: { enabled: true },
      success_url: `${process.env.CLIENT_URL}/checkout?success=true&orderId=${orderId}`,
      cancel_url: `${process.env.CLIENT_URL}/checkout`,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));