require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const nodemailer = require("nodemailer");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_FROM,
    pass: EMAIL_PASS,
  },
});

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
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const source = msg.guild
    ? `[${msg.guild.name} #${msg.channel.name}]`
    : "[DM]";

  const body = `${source}\n${msg.author.username}: ${msg.content}`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: "Discord Alert",
      text: body,
    });

    console.log("Text sent:", body);
  } catch (err) {
    console.error("Email error:", err);
  }
});

client.login(DISCORD_TOKEN);