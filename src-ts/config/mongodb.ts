import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI as string);

  await client.connect();

  db = client.db();

  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB not initialized");
  }

  return db;
}
