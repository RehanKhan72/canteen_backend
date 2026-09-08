// src-ts/config/hdfc.ts
// HDFC Collect Now — Razorpay-compatible client initialization.
// The Razorpay SDK is reused because HDFC's integration kit is API-compatible.
import Razorpay from "razorpay";
const hdfcInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});
export default hdfcInstance;
