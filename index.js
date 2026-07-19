require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const twilio = require("twilio");
const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("OK"));

const MESSENGER_WEBHOOK_SECRET = process.env.MESSENGER_WEBHOOK_SECRET;

app.use(express.json());

app.use("/messenger-webhook", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Forwarder-Secret");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.post("/messenger-webhook", async (req, res) => {
  if (req.headers["x-forwarder-secret"] !== MESSENGER_WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }

  const { title, body } = req.body;

  try {
    await twilioClient.messages.create({
      body: `Messenger — ${title}: ${body}`,
      from: TWILIO_FROM_NUMBER,
      to: process.env.SMS_TO,
    });
    console.log("Forwarded Messenger notification via SMS.");
  } catch (err) {
    console.error("Messenger SMS error:", err?.message || err);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 8080, "0.0.0.0", () => console.log("Health check server running"));

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER; // your Twilio number, e.g. +16413815509
const SMS_TO = process.env.SMS_TO; // your Light Phone number, e.g. +14087068540

// How long to wait after the last message before sending the text (ms)
const BATCH_WINDOW_MS = 30 * 1000;
// Safety cap: if messages keep flowing, force a send after this long anyway (ms)
const MAX_WAIT_MS = 2 * 60 * 1000;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

requireEnv("DISCORD_TOKEN");
requireEnv("TWILIO_ACCOUNT_SID");
requireEnv("TWILIO_AUTH_TOKEN");
requireEnv("TWILIO_FROM_NUMBER");
requireEnv("SMS_TO");

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// --- Batching state ---
let pendingMessages = [];
let debounceTimer = null;
let maxWaitTimer = null;

function queueMessage(entry) {
  pendingMessages.push(entry);

  // Reset the "quiet period" timer every time a new message arrives
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushAndSend, BATCH_WINDOW_MS);

  // Start the hard cap timer only once, when the batch begins
  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(flushAndSend, MAX_WAIT_MS);
  }
}

async function flushAndSend() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (maxWaitTimer) clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;

  if (pendingMessages.length === 0) return;

  const batch = pendingMessages;
  pendingMessages = [];

  const count = batch.length;
  const intro =
    count === 1
      ? "You have 1 new Discord message."
      : `You have ${count} new Discord messages.`;

  const lines = batch.map((m, i) => `${i + 1}. [${m.source}] ${m.author}: ${m.content}`);
  const body = `${intro}\n${lines.join("\n")}`;

  const trimmedBody = body.length > 1500 ? body.slice(0, 1497) + "..." : body;

  try {
    const message = await twilioClient.messages.create({
      body: trimmedBody,
      from: TWILIO_FROM_NUMBER,
      to: SMS_TO,
    });
    console.log(`Text sent for batch of ${count} message(s). SID: ${message.sid}`);
  } catch (err) {
    console.error("Twilio SMS error:", err?.message || err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag} (${client.user.id})`);
  console.log("Guilds:", client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(" | "));
});

client.on("messageCreate", async (msg) => {
  try {
    if (msg.author?.bot) return;

    const content = (msg.content || "").trim();
    if (!content) return;

    const source = msg.guild
      ? `${msg.guild.name}, channel ${msg.channel?.name || "unknown"}`
      : `a direct message`;

    queueMessage({
      source,
      author: msg.author.username,
      content,
    });

    console.log("Queued message:", content);
  } catch (err) {
    console.error("Error queueing message:", err?.message || err);
  }
});

client.login(DISCORD_TOKEN);