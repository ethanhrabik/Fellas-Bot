const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} = require("@discordjs/voice");

const { spawn } = require("child_process");

client.on("messageCreate", async message => {
  if (!message.content.startsWith("!play")) return;

  const url = message.content.split(" ")[1];
  if (!url) return message.reply("Provide a YouTube URL.");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply("Join a voice channel first.");

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator
  });

  const yt = spawn("yt-dlp", [
    "-f", "bestaudio",
    "-o", "-",
    url
  ]);

  const resource = createAudioResource(yt.stdout);
  const player = createAudioPlayer();

  player.play(resource);
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    connection.destroy();
  });
});
