const express = require('express');
const passport = require('passport');
const session = require('express-session');
const fs = require('fs');
const dotenv = require('dotenv');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Allow dynamic port for Render
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Use environment variables for OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/google/callback` // Use dynamic URL for Render
}, (accessToken, refreshToken, profile, done) => {
    // Extract required user details
    const userData = {
        name: profile.displayName,
        email: profile.emails[0].value,
        profilePic: profile.photos[0].value
    };
    
    // Log user info to the console (Render does not allow file writing)
    console.log("User Logged In:", userData);
    
    return done(null, userData);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Route to start Google OAuth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback route after Google authentication
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }), 
    (req, res) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication failed" });
        }
        
        res.json(req.user); // Send only required info as JSON
    }
);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    