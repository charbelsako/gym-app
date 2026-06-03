import mongoose from "mongoose";

const uri =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/gym-app";

export async function connectDb() {
  await mongoose.connect(uri);
  console.log(`MongoDB connected (${mongoose.connection.name})`);
}

export function getDbState() {
  const state = mongoose.connection.readyState;
  const labels = ["disconnected", "connected", "connecting", "disconnecting"];
  return labels[state] ?? "unknown";
}
