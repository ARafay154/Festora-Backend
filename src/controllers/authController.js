const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();

const User = require('../models/users');
const Token = require('../models/token');

const SECRET_KEY = process.env.SECRET_KEY;
const TOKEN_EXPIRES_IN = '24h';
const TOKEN_EXPIRES_AT_MS = 24 * 60 * 60 * 1000;

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------- CREATE USER ----------------
router.post('/create-user', async (req, res) => {
  try {
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ msg: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 12);

    const newUser = new User({
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: req.body.name,
      email: req.body.email,
      passwordHash: hashedPassword,
      phone: req.body.phone,
      country: req.body.country,
      city: req.body.city,
      preferences: req.body.preferences || [],
      favoriteArtists: req.body.favoriteArtists || [],
      favoriteVenues: req.body.favoriteVenues || [],
      profileComplete: false,
      accountVerified: false
    });

    const saveUser = await newUser.save();

    // Create token for new user
    const token = jwt.sign({ user_id: saveUser.id }, SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN });
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_AT_MS);

    await new Token({
      user_id: saveUser.id,
      token,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(200).json({
      msg: "User created successfully",
      user: {
        id: saveUser.id,
        name: saveUser.name,
        email: saveUser.email,
        profileComplete: saveUser.profileComplete,
        accountVerified: saveUser.accountVerified
      },
      token
    });

  } catch (error) {
    res.status(500).json({ msg: "Error creating user", error: error.message });
  }
});

// ---------------- LOGIN ----------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "Email not found" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ msg: "Incorrect password" });

    // SIMPLE SINGLE-DEVICE LOGIC: Delete old token, create new one
    await Token.deleteMany({ user_id: user.id }); // Remove old token

    // Create new token
    const token = jwt.sign({ user_id: user.id }, SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN });
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_AT_MS);

    await new Token({
      user_id: user.id,
      token,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(200).json({ 
      msg: "Login successful", 
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileComplete: user.profileComplete,
        accountVerified: user.accountVerified
      }
    });

  } catch (error) {
    res.status(500).json({ msg: "Login error", error: error.message });
  }
});

// ---------------- GET USER BY TOKEN ----------------
router.get('/get-user', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    const tokenData = await Token.findOne({ token });
    if (!tokenData) return res.status(401).json({ msg: "Invalid token" });

    // Check if token is expired
    if (tokenData.expiresAt < new Date()) {
      await Token.deleteOne({ token }); // Clean up expired token
      return res.status(401).json({ msg: "Token expired" });
    }

    const user = await User.findOne({ id: tokenData.user_id });
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.status(200).json({
      msg: "User found",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        city: user.city,
        preferences: user.preferences,
        favoriteArtists: user.favoriteArtists,
        favoriteVenues: user.favoriteVenues,
        profileComplete: user.profileComplete,
        accountVerified: user.accountVerified
      }
    });

  } catch (error) {
    res.status(500).json({ msg: "Error fetching user", error: error.message });
  }
});

// ---------------- LOGOUT ----------------
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    const result = await Token.findOneAndDelete({ token });
    if (!result) return res.status(401).json({ msg: "Invalid token" });

    res.status(200).json({ msg: "Logged out successfully" });

  } catch (error) {
    res.status(500).json({ msg: "Logout error", error: error.message });
  }
});

// ---------------- UPDATE USER PROFILE ----------------
router.put('/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ msg: "No token provided" });

    const tokenData = await Token.findOne({ token });
    if (!tokenData) return res.status(401).json({ msg: "Invalid token" });

    if (tokenData.expiresAt < new Date()) {
      await Token.deleteOne({ token });
      return res.status(401).json({ msg: "Token expired" });
    }

    const user = await User.findOne({ id: tokenData.user_id });
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Update allowed fields
    const allowedUpdates = ['name', 'phone', 'country', 'city', 'preferences', 'favoriteArtists', 'favoriteVenues'];
    let hasUpdates = false;

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
        hasUpdates = true;
      }
    });

    // Check if profile is now complete
    if (user.name && user.phone && user.country && user.city) {
      user.profileComplete = true;
      hasUpdates = true;
    }

    if (hasUpdates) {
      await user.save();
    }

    res.status(200).json({
      msg: "Profile updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        city: user.city,
        preferences: user.preferences,
        favoriteArtists: user.favoriteArtists,
        favoriteVenues: user.favoriteVenues,
        profileComplete: user.profileComplete,
        accountVerified: user.accountVerified
      }
    });

  } catch (error) {
    res.status(500).json({ msg: "Error updating profile", error: error.message });
  }
});

module.exports = router;
