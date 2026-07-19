require("dotenv").config();
const twilio = require("twilio");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const SMS_TO = process.env.SMS_TO;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

requireEnv("TWILIO_ACCOUNT_SID");
requireEnv("TWILIO_AUTH_TOKEN");
requireEnv("TWILIO_FROM_NUMBER");
requireEnv("SMS_TO");

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function main() {
  console.log("Sending test SMS...");
  console.log(`From: ${TWILIO_FROM_NUMBER}`);
  console.log(`To:   ${SMS_TO}`);

  try {
    const message = await client.messages.create({
      body: "Test message from your Discord forwarder setup. If you got this, Twilio is working!",
      from: TWILIO_FROM_NUMBER,
      to: SMS_TO,
    });

    console.log("\n✅ Success!");
    console.log("Message SID:", message.sid);
    console.log("Status:", message.status);
  } catch (err) {
    console.error("\n❌ Failed to send message.");
    console.error("Error code:", err.code);
    console.error("Message:", err.message);

    if (err.code === 21608) {
      console.error("\nHint: This usually means your trial account can only send to verified numbers, or your toll-free number isn't verified yet.");
    }
    if (err.code === 21606) {
      console.error("\nHint: The 'from' number is not a valid, SMS-capable Twilio number for your account.");
    }

    process.exit(1);
  }
}

main();
