require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());

const PORT = 3000;

// Redirect to Google OAuth
app.get('/auth/google', (req, res) => {
  const googleAuthURL = `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=openid%20email%20profile&access_type=online&state=${req.hostname}`;
  res.redirect(googleAuthURL);
});

// Google OAuth Callback
app.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    // Exchange code for access token
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
    });

    const { access_token } = data;

    // Fetch user details from Google
    const { data: googleUser } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const email = googleUser.email;

    // Check if user exists in Shopify
    const { data: shopifyCustomers } = await axios.get(`${process.env.SHOPIFY_STORE_URL}/admin/api/2023-07/customers/search.json?query=email:${email}`, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (shopifyCustomers.customers.length > 0) {
      // Customer exists → Log them in (Set session cookie)
      res.cookie('shopify_user', email, { httpOnly: true, secure: true, maxAge: 24 * 60 * 60 * 1000 });
      return res.redirect('/account');
    } else {
      // Customer does not exist → Create an account
      const newCustomer = {
        customer: {
          first_name: googleUser.given_name,
          last_name: googleUser.family_name,
          email: email,
          verified_email: true,
          send_email_welcome: true,
        },
      };

      await axios.post(`${process.env.SHOPIFY_STORE_URL}/admin/api/2023-07/customers.json`, newCustomer, {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_TOKEN,
          "Content-Type": "application/json",
        },
      });

      // Set session cookie for newly created user
      res.cookie('shopify_user', email, { httpOnly: true, secure: true, maxAge: 24 * 60 * 60 * 1000 });
      return res.redirect('/account');
    }
  } catch (error) {
    console.error('OAuth Error:', error.response?.data || error.message);
    return res.status(500).send('Authentication failed');
  }
});

// Logout (Clear session)
app.get('/logout', (req, res) => {
  res.clearCookie('shopify_user');
  res.redirect('/account/login');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
