import { getDb } from "../../dist/config/mongodb.js";
import crypto from "crypto";
export async function createResetToken(email) {
    const db = getDb();
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
    await db.collection("passwordResets").insertOne({
        email,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 mins
    });
    return token;
}
export async function verifyResetToken(token) {
    const db = getDb();
    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
    const record = await db.collection("passwordResets").findOne({
        token: hashedToken,
        expiresAt: { $gt: new Date() },
    });
    return record;
}
export async function deleteResetToken(token) {
    const db = getDb();
    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
    await db.collection("passwordResets").deleteOne({ token: hashedToken });
}
