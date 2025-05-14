import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

let cached = globalThis.mongoose || { conn: null, promise: null };

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn; // If the connection is cached, return it immediately
  }

  // If there's no cached promise, initiate a new connection with retry logic
  if (!cached.promise) {
    cached.promise = attemptToConnect();
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Retry connection logic
const attemptToConnect = async (attempts = MAX_RETRIES): Promise<typeof mongoose> => {
  try {
    console.log('Attempting to connect to MongoDB...');
    return await mongoose.connect(MONGODB_URI, {
      bufferCommands: false, // Prevents mongoose from buffering commands while disconnected
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    if (attempts > 0) {
      console.log(`Retrying... (${attempts - 1} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
      return attemptToConnect(attempts - 1);
    }
    console.error('Failed to connect to MongoDB after multiple attempts');
    throw err;
  }
};
