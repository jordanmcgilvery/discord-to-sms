require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const twilio = require("twilio");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER; // your Twilio number, e.g. +15551234567
const SMS_TO = process.env.SMS_TO; // your personal phone number, e.g. +15559876543

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
      ? `[${msg.guild.name} #${msg.channel?.name || "unknown"}]`
      : `[DM]`;

    const body = `${source}\n${msg.author.username}: ${content}`;

    // SMS bodies are best kept short; trim to a safe length (1 SMS segment ~160 chars)
    const smsBody = body.length > 320 ? body.slice(0, 317) + "..." : body;

    await twilioClient.messages.create({
      body: smsBody,
      from: TWILIO_FROM_NUMBER,
      to: SMS_TO,
    });

    console.log("Text sent:", body);
  } catch (err) {
    console.error("Twilio error:", err?.message || err);
  }
});

client.login(DISCORD_TOKEN);