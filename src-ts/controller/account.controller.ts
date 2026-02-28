import { Request, Response } from "express";
import { Client, Users } from "node-appwrite";
import MongoDatasource from "../../src/services/datasource/MongoDatasource.js";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const users = new Users(client);
const mongo = new MongoDatasource();

export const deleteAccountController = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }
    
    if (!req.headers["x-internal-secret"] ||
      req.headers["x-internal-secret"] !== process.env.INTERNAL_DELETE_SECRET) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 1️⃣ Delete from Appwrite
    await users.delete(userId);

    // 2️⃣ Delete from Mongo (users collection)
    await mongo.deleteDocument({
      collection: "users",
      docId: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });

  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      success: false,
      message: "Account deletion failed",
    });
  }
};