require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioResource, AudioPlayerStatus, createAudioPlayer } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
});

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
const guildQueues = new Map();

async function getSoundCloudURL(trackURL) {
    try {
        const resolveURL = `https://api.soundcloud.com/resolve?url=${trackURL}&client_id=${SOUNDCLOUD_CLIENT_ID}`;
        const response = await axios.get(resolveURL);
        const trackID = response.data.id;
        return `https://api.soundcloud.com/tracks/${trackID}/stream?client_id=${SOUNDCLOUD_CLIENT_ID}`;
    } catch (error) {
        console.error("Error fetching SoundCloud track:", error);
        return null;
    }
}

class GuildQueue {
    constructor(channel) {
        this.channel = channel;
        this.queue = [];
        this.player = createAudioPlayer();
        this.connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
        this.connection.subscribe(this.player);
    }

    currentTrack() {
        return this.queue[0];
    }

    upcomingTracks() {
        return this.queue.slice(1);
    }

    enqueue(streamURL) {
        this.queue.push(streamURL);
        if (this.queue.length === 1) {  // If it's the only song in the queue
            this.playNext();
        }
    }

    playNext() {
        if (!this.queue.length) {
            this.connection.destroy();
            return;
        }
        const nextTrack = this.queue[0];
        const resource = createAudioResource(ytdl(nextTrack, { filter: 'audioonly', quality: 'highestaudio' }));
        this.player.play(resource);

        this.player.once(AudioPlayerStatus.Idle, () => {
            this.queue.shift();
            this.playNext();
        });
    }

    pause() {
        if (this.player.state.status !== AudioPlayerStatus.Paused) {
            this.player.pause();
        }
    }

    resume() {
        if (this.player.state.status === AudioPlayerStatus.Paused) {
            this.player.unpause();
        }
    }

    skip() {
        this.queue.shift();
        this.playNext();
    }
}


client.once('ready', async () => {
    console.log('Logged in as ' + client.user.tag);

    const commands = [
        {
            name: 'play',
            description: 'Plays a song from YouTube or SoundCloud',
            options: [{
                name: 'url',
                type: 3,
                description: 'The URL of the song',
                required: true,
            }],
        },
        { name: 'pause', description: 'Pauses the currently playing song' },
        { name: 'resume', description: 'Resumes the paused song' },
        { name: 'skip', description: 'Skips the currently playing song' },
        { name: 'current', description: 'Shows the currently playing song' },
        { name: 'queue', description: 'Displays the current song queue' },
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

    await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), {
        body: commands,
    });

    console.log('Successfully registered slash commands.');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const guild = interaction.guild;
    if (!guild) return;

    let queue = guildQueues.get(guild.id);

    switch (commandName) {
        case 'play':
            const url = interaction.options.getString('url');
            let streamURL;
            if (url.includes('youtube.com')) {
                if (!ytdl.validateURL(url)) {
                    return await interaction.reply('Invalid YouTube URL.');
                }
                streamURL = url;
            } else if (url.includes('soundcloud.com')) {
                streamURL = await getSoundCloudURL(url);
                if (!streamURL) {
                    return await interaction.reply('Error fetching the SoundCloud track.');
                }
            } else {
                return await interaction.reply('Unsupported URL. Please provide a YouTube or SoundCloud link.');
            }

            if (!queue) {
                const channel = interaction.member.voice.channel;
                if (!channel) {
                    return await interaction.reply('You need to be in a voice channel first.');
                }
                queue = new GuildQueue(channel);
                guildQueues.set(guild.id, queue);
            }

            queue.enqueue(streamURL);
            await interaction.reply('Added to queue!');
            break;
        case 'pause':
            if (queue) {
                queue.pause();
                await interaction.reply('Paused the song!');
            } else {
                await interaction.reply('No song is currently playing.');
            }
            break;
        case 'resume':
            if (queue) {
                queue.resume();
                await interaction.reply('Resumed the song!');
            } else {
                await interaction.reply('No song is currently paused.');
            }
            break;
        case 'skip':
            if (queue) {
                queue.skip();
                await interaction.reply('Skipped the song!');
            } else {
                await interaction.reply('No song is currently playing.');
            }
            break;
        case 'current':
            if (queue && queue.currentTrack()) {
                await interaction.reply(`Now playing: ${queue.currentTrack()}`);
            } else {
                await interaction.reply('No song is currently playing.');
            }
            break;
        case 'queue':
            if (queue) {
                const upcoming = queue.upcomingTracks();
                if (upcoming.length) {
                    await interaction.reply(`Next songs:\n${upcoming.join('\n')}`);
                } else {
                    await interaction.reply('No more songs in the queue.');
                }
            } else {
                await interaction.reply('No songs in the queue.');
            }
            break;
    }
});

client.login(process.env.BOT_TOKEN);
