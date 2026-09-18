import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// ES modules don't have __dirname, so we create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Create a backup .env file if it doesn't exist
const envPath = path.resolve(__dirname, '.env');
console.log(`Looking for .env file at: ${envPath}`);

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',  // Specific origin instead of wildcard '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true  // Allow credentials
}));
app.use(express.json());

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://shayaanpk:QBlvNkoTYFQbXsq1@clusterlogin.mioes.mongodb.net/trading_app?retryWrites=true&w=majority&appName=ClusterLogin';

// Flag to track MongoDB connection status
let isMongoConnected = false;

// Connect to MongoDB
console.log('Attempting to connect to MongoDB...');
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('Connected to MongoDB successfully');
  isMongoConnected = true;
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.log('Server will continue but database operations will not be available');
});

// Define MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  isMongoConnected = false;
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
  isMongoConnected = true;
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
  isMongoConnected = false;
});

// User Schema
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Register route
app.post('/api/auth/register', async (req, res) => {
  try {
    // Check MongoDB connection
    if (!isMongoConnected) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection unavailable. Please try again later.' 
      });
    }

    const { fullName, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword
    });
    
    await newUser.save();
    
    // Generate JWT
    const token = jwt.sign(
      { userId: newUser._id }, 
      process.env.JWT_SECRET || 'fallback_secret_key_for_development',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      userId: newUser._id,
      fullName: newUser.fullName
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    // Check MongoDB connection
    if (!isMongoConnected) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection unavailable. Please try again later.' 
      });
    }

    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret_key_for_development',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      userId: user._id,
      fullName: user.fullName
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Handle preflight OPTIONS requests for the delete endpoint
app.options('/api/user/delete', cors());

// Delete user account
app.delete('/api/user/delete', async (req, res) => {
  try {
    // Check MongoDB connection
    if (!isMongoConnected) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection unavailable. Please try again later.' 
      });
    }

    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and password are required' 
      });
    }
    
    // Log the received data for debugging
    console.log('Received deletion request for userId:', userId);
    
    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }
    
    // Delete user-related data
    
    // 1. Delete watchlist data - Assuming there's a Watchlist model
    try {
      const Watchlist = mongoose.model('Watchlist');
      await Watchlist.deleteMany({ userId: userId });
    } catch (error) {
      console.log('No Watchlist model found or error deleting watchlist data', error);
    }
    
    // 2. Delete portfolio data - Assuming there's a Portfolio model
    try {
      const Portfolio = mongoose.model('Portfolio');
      await Portfolio.deleteMany({ userId: userId });
    } catch (error) {
      console.log('No Portfolio model found or error deleting portfolio data', error);
    }
    
    // 3. Delete analysis history - Assuming there's an AnalysisHistory model
    try {
      const AnalysisHistory = mongoose.model('AnalysisHistory');
      await AnalysisHistory.deleteMany({ userId: userId });
    } catch (error) {
      console.log('No AnalysisHistory model found or error deleting analysis history', error);
    }
    
    // 4. Delete any other user-related data...
    
    // Finally, delete the user
    await User.findByIdAndDelete(userId);
    
    res.json({ 
      success: true, 
      message: 'User account and all related data successfully deleted' 
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during account deletion' 
    });
  }
});

// MongoDB connection status endpoint
app.get('/api/auth/status', (req, res) => {
  res.json({
    mongoConnected: isMongoConnected,
    message: isMongoConnected ? 'MongoDB is connected' : 'MongoDB is not connected'
  });
});

// Simple test route
app.get('/api/auth/test', (req, res) => {
  res.json({ message: 'Auth server is running' });
});

// Debug route to see all environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    MONGODB_URI: process.env.MONGODB_URI || 'Not set',
    JWT_SECRET: process.env.JWT_SECRET ? 'Set (hidden)' : 'Not set',
    PORT: process.env.PORT || 'Not set'
  });
});

const PORT = 5004;
app.listen(PORT, () => console.log(`Auth server running on port ${PORT}`));