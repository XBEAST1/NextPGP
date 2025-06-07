import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

// Extend NodeJS global to cache the connection across hot reloads in Vercel
declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.mongooseCache) {
  global.mongooseCache = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Return cached connection if it exists
  if (global.mongooseCache.conn) {
    return global.mongooseCache.conn;
  }

  // If there's no ongoing connection attempt, start one with retry logic
  if (!global.mongooseCache.promise) {
    global.mongooseCache.promise = attemptToConnect();
  }

  // Await the promise, cache and return the connection
  global.mongooseCache.conn = await global.mongooseCache.promise;
  return global.mongooseCache.conn;
}

async function attemptToConnect(attemptsLeft = MAX_RETRIES): Promise<typeof mongoose> {
  try {
    console.log('Attempting to connect to MongoDB...');
    return await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      family: 4,
      retryWrites: true,
      tls: true,
    });    
    
  } catch (err) {
    console.error('MongoDB connection error:', err);
    if (attemptsLeft > 0) {
      console.log(`Retrying MongoDB connection (${attemptsLeft - 1} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return attemptToConnect(attemptsLeft - 1);
    }
    console.error('Failed to connect to MongoDB after multiple attempts');
    throw err;
  }
}
