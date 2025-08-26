require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB Atlas connection string from environment variable
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment variables');
  process.exit(1);
}

// MongoDB connection options for production (Mongoose v8 compliant)
const mongooseOptions = {
  maxPoolSize: 10,                 // Connection pool size
  serverSelectionTimeoutMS: 5000,  // Server selection timeout
  socketTimeoutMS: 45000,          // Socket operation timeout
  // Mongoose v8 uses driver's defaults for useNewUrlParser/useUnifiedTopology
  // Buffering is controlled by bufferCommands only
  bufferCommands: false
};

// Connect to MongoDB Atlas
mongoose.connect(MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('✅ Successfully connected to MongoDB Atlas');
  })
  .catch((err) => {
    console.error('❌ MongoDB Atlas connection error:', err.message);
    process.exit(1);
  });

mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB Atlas');
});

// Handle application termination gracefully
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 Mongoose connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing mongoose connection:', err.message);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = mongoose;