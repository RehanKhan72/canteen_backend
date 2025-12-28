import { MongoClient } from "mongodb";
import logger from "../services/logger.service.js";

let client;
let db;

export async function connectMongo() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI);

  await client.connect();

  db = client.db(); // uses DB name from URI

  logger.info("✅ MongoDB connected");

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("MongoDB not initialized");
  }
  return db;
}
