/**
 * Discord YouTube Audio Bot
 * DigitalOcean-ready
 */

require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require("@discordjs/voice");

const { spawn } = require("child_process");
const path = require("path");

// ==========================
// Client Setup
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

// ==========================
// Music State (per guild)
// ==========================
const queues = new Map();

// ==========================
// Cookies Path
// ==========================
const COOKIES_PATH = path.join(__dirname, "cookies.txt"); // put your exported YouTube cookies here

// ==========================
// Bot Ready
// ==========================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ==========================
// Message Handler
// ==========================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  switch (command) {
    case "play":
      return playCommand(message, args);
    case "skip":
      return skipCommand(message);
    case "stop":
      return stopCommand(message);
  }
});

// ==========================
// Commands
// ==========================
async function playCommand(message, args) {
  const url = args[0];
  if (!url) return message.reply("❌ Provide a YouTube URL or 'test'.");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply("❌ Join a voice channel first.");

  let queue = queues.get(message.guild.id);

  if (!queue) {
    queue = createQueue(message, voiceChannel);
    queues.set(message.guild.id, queue);
  }

  queue.songs.push(url);
  message.reply(`🎶 Added to queue (${queue.songs.length})`);

  if (!queue.player.state.resource) playNext(message.guild.id);
}

function skipCommand(message) {
  const queue = queues.get(message.guild.id);
  if (!queue) return message.reply("❌ Nothing playing.");

  queue.player.stop();
  message.reply("⏭️ Skipped.");
}

function stopCommand(message) {
  const queue = queues.get(message.guild.id);
  if (!queue) return message.reply("❌ Nothing to stop.");

  queue.songs = [];
  queue.player.stop();
  queue.connection.destroy();
  queues.delete(message.guild.id);

  message.reply("🛑 Stopped and cleared queue.");
}

// ==========================
// Queue Helpers
// ==========================
function createQueue(message, voiceChannel) {
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });

  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    playNext(message.guild.id);
  });

  player.on("error", (error) => {
    console.error("Audio player error:", error);
    playNext(message.guild.id);
  });

  return {
    textChannel: message.channel,
    voiceChannel,
    connection,
    player,
    songs: [],
  };
}

// ==========================
// Play Next Function
// ==========================
function playNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;

  const url = queue.songs.shift();
  if (!url) {
    queue.connection.destroy();
    queues.delete(guildId);
    return;
  }

  console.log("▶️ Playing:", url);

  // Local test file
  if (url === "test") {
    const resource = createAudioResource("test.mp3");
    queue.player.play(resource);
    queue.player.once(AudioPlayerStatus.Idle, () => {
      console.log("Finished test.mp3");
      playNext(guildId);
    });
    return;
  }

  try {
    // Spawn yt-dlp with cookies to bypass bot checks
    const ytProcess = spawn("yt-dlp", [
      "-f",
      "bestaudio",
      "--cookies",
      COOKIES_PATH,
      "-o",
      "-",
      url,
    ]);

    // Pipe into ffmpeg
    const ffmpegProcess = spawn("ffmpeg", [
      "-i",
      "pipe:0",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "pipe:1",
    ]);

    ytProcess.stdout.pipe(ffmpegProcess.stdin);

    const resource = createAudioResource(ffmpegProcess.stdout);
    queue.player.play(resource);

    // Handle end of track
    queue.player.once(AudioPlayerStatus.Idle, () => {
      console.log("Finished playing:", url);
      playNext(guildId);
    });

    // Log errors
    ytProcess.stderr.on("data", (data) => {
      console.error("yt-dlp error:", data.toString());
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.error("ffmpeg error:", data.toString());
    });

    // Skip broken video
    ytProcess.on("close", (code) => {
      if (code !== 0) {
        console.log(`⚠️ yt-dlp failed with code ${code}, skipping`);
        playNext(guildId);
      }
    });
  } catch (err) {
    console.error("Failed to play URL:", err);
    playNext(guildId); // skip broken URL
  }
}

// ==========================
// Login
// ==========================
client.login(process.env.DISCORD_TOKEN);
