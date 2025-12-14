/**
 * Discord YouTube Audio Bot
 * DigitalOcean-ready
 */

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const { spawn } = require("child_process");

// ==========================
// Client Setup
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// ==========================
// Music State (per guild)
// ==========================
const queues = new Map();
// queues[guildId] = {
//   textChannel,
//   voiceChannel,
//   connection,
//   player,
//   songs: []
// }

// ==========================
// Bot Ready
// ==========================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ==========================
// Message Handler
// ==========================
client.on("messageCreate", async message => {
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
  if (!url) return message.reply("❌ Provide a YouTube URL.");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply("❌ Join a voice channel first.");
  }

  let queue = queues.get(message.guild.id);

  if (!queue) {
    queue = createQueue(message, voiceChannel);
    queues.set(message.guild.id, queue);
  }

  queue.songs.push(url);
  message.reply(`🎶 Added to queue (${queue.songs.length})`);

  if (!queue.player.state.resource) {
    playNext(message.guild.id);
  }
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
      noSubscriber: NoSubscriberBehavior.Pause
    }
  });

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator
  });

  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    playNext(message.guild.id);
  });

  player.on("error", error => {
    console.error("Audio player error:", error);
    playNext(message.guild.id);
  });

  return {
    textChannel: message.channel,
    voiceChannel,
    connection,
    player,
    songs: []
  };
}

function playNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;

  console.log("Playing local test.mp3");

  const resource = createAudioResource("test.mp3");
  queue.player.play(resource);

  queue.player.once(AudioPlayerStatus.Idle, () => {
    console.log("Finished test.mp3");
  });
}

  const resource = createAudioResource(ytProcess.stdout);

  queue.player.play(resource);


// ==========================
// Login
// ==========================
client.login(process.env.DISCORD_TOKEN);
