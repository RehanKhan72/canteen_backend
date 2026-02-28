import { Request, Response } from "express";
import { Client, Users, Account } from "node-appwrite";
import MongoDatasource from "../../src/services/datasource/MongoDatasource.js";

const adminClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const users = new Users(adminClient);
const mongo = new MongoDatasource();

export const deleteAccountController = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId, email, password } = req.body;

    if (!userId || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (
      req.headers["x-internal-secret"] !==
      process.env.INTERNAL_DELETE_SECRET
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 🔥 1️⃣ Verify password using temporary Appwrite client (NO API KEY)
    const verifyClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!);

    const account = new Account(verifyClient);

    try {
      await account.createEmailPasswordSession(email, password);
    } catch (err) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 🔥 2️⃣ Delete user from Appwrite (Admin SDK)
    await users.delete(userId);

    // 🔥 3️⃣ Delete from Mongo
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