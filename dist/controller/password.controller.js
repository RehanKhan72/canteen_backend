import { Client, Users } from "node-appwrite";
import { createResetToken, verifyResetToken, deleteResetToken } from "../models/passwordReset.model.js";
import { getDb } from "../../dist/config/mongodb.js";
import nodemailer from "nodemailer";
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const users = new Users(client);
export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const db = getDb();
        const user = await db.collection("users").findOne({ email });
        if (!user) {
            return res.status(200).json({ success: true });
        }
        const token = await createResetToken(email);
        const resetLink = `${process.env.BASE_URL}/reset-password?token=${token}`;
        // simple mail
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });
        await transporter.sendMail({
            to: email,
            subject: "Reset your password",
            html: `
        <h3>Reset Password</h3>
        <p>Click below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
      `,
        });
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};
export const serveResetPage = async (req, res) => {
    const { token } = req.query;
    res.send(`
    <form method="POST" action="/reset-password">
      <input type="hidden" name="token" value="${token}" />
      <input type="password" name="password" placeholder="New Password" required />
      <button type="submit">Reset Password</button>
    </form>
  `);
};
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const record = await verifyResetToken(token);
        if (!record) {
            return res.send("Invalid or expired link");
        }
        const db = getDb();
        const user = await db.collection("users").findOne({ email: record.email });
        if (!user)
            return res.send("User not found");
        await users.updatePassword(user._id, password);
        await deleteResetToken(token);
        res.send("Password reset successful");
    }
    catch (err) {
        console.error(err);
        res.send("Error resetting password");
    }
};
