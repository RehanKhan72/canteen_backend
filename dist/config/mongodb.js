import { MongoClient } from "mongodb";
let client = null;
let db = null;
export async function connectMongo() {
    if (db)
        return db;
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
    return db;
}
export function getDb() {
    if (!db) {
        throw new Error("MongoDB not initialized");
    }
    return db;
}
