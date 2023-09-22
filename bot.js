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
const guildQueues = new Map();

async function searchYoutube(query) {
    const { data } = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`);
    if (!data.items.length) return null;
    return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
}

const fetchCooldowns = new Set();

function isOnCooldown(guildId) {
    return fetchCooldowns.has(guildId);
}

function setCooldown(guildId) {
    fetchCooldowns.add(guildId);
    setTimeout(() => {
        fetchCooldowns.delete(guildId);
    }, 10);  // 10 seconds cooldown (adjust as necessary)
}

async function fetchRelatedVideos(videoId) {
    try {
        // Check cooldown here
        if (isOnCooldown(videoId)) {
            console.log('On cooldown for fetching related videos.');
            return null;
        }

        const { data } = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&relatedToVideoId=${videoId}&type=video&key=${YOUTUBE_API_KEY}`);
        if (!data.items.length) return null;
        
        // Set the cooldown after making a successful request
        setCooldown(videoId);
        
        return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
    } catch (error) {
        console.error("Error fetching related videos:", error);
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
        if (!streamURL) {
            console.error('Stream URL is undefined');
            return;
        }
        
        this.queue.push(streamURL);

        // If the song isn't currently playing, start playing.
        if (this.player.state.status === AudioPlayerStatus.Idle) {
            this.playNext();
        }
    }

    playNext() {
        if (!this.queue.length) {
            const currentTrack = this.currentTrack();
            if (currentTrack) {  // Check if currentTrack exists
                const currentVideoId = new URL(currentTrack).searchParams.get("v");
                fetchRelatedVideos(currentVideoId).then(relatedVideoURL => {
                    if (relatedVideoURL) {
                        this.enqueue(relatedVideoURL);
                        this.playNext();
                    }
                }).catch(error => {
                    console.error("Error fetching the next recommended song:", error);
                });
            }
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
        
        if (!this.queue.length) { // If the queue is empty
            const currentTrack = this.currentTrack();
            if (currentTrack) {  // Check if currentTrack exists
                const currentVideoId = new URL(currentTrack).searchParams.get("v");
                fetchRelatedVideos(currentVideoId).then(relatedVideoURL => {
                    if (relatedVideoURL) {
                        this.enqueue(relatedVideoURL);
                        this.playNext();
                    }
                }).catch(error => {
                    console.error("Error fetching the next recommended song:", error);
                });
            }
            return;
        }
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
    try {
        await interaction.deferReply().catch(error => {
            console.error("Error deferring reply:", error);
            throw new Error("Failed to defer reply"); // Stop execution if deferring fails
        });
        const { commandName } = interaction;
        const guild = interaction.guild;
        if (!guild) return;

        let queue = guildQueues.get(guild.id);

        switch (commandName) {
            case 'play':
                if (isOnCooldown(guild.id)) {
                    return await interaction.editReply('Wait a bit before searching for another song.');
                }
                const query = interaction.options.getString('url');
                let streamURL;
                if (!query.startsWith('http')) {
                    streamURL = await searchYoutube(query);
                    if (!streamURL) {
                        return await interaction.editReply('No results found.');
                    }
                } else {
                    if (query.includes('youtube.com')) {
                        if (!ytdl.validateURL(query)) {
                            return await interaction.editReply('Invalid YouTube URL.');
                        }
                        streamURL = query;
                    } else if (query.includes('soundcloud.com')) {
                        // Implement your SoundCloud fetching logic here
                        return await interaction.editReply('SoundCloud support is not yet implemented.');
                    } else {
                        return await interaction.editReply('Unsupported URL. Please provide a YouTube or SoundCloud link.');
                    }
                }

                if (!queue) {
                    const channel = interaction.member.voice.channel;
                    if (!channel) {
                        return await interaction.editReply('You need to be in a voice channel first.');
                    }
                    queue = new GuildQueue(channel);
                    guildQueues.set(guild.id, queue);
                }

                queue.enqueue(streamURL);
                await interaction.editReply('Added to queue!');
                break;
        
        case 'pause':
            if (queue) {
                queue.pause();
                await interaction.editReply('Paused the song!');
            } else {
                await interaction.editReply('No song is currently playing.');
            }
            break;
        case 'resume':
            if (queue) {
                queue.resume();
                await interaction.eidtReply('Resumed the song!');
            } else {
                await interaction.editReply('No song is currently paused.');
            }
            break;
        
            case 'skip':
                if (queue) {
                    queue.skip();
                    await interaction.editReply('Skipped to the next song!');
                } else {
                    await interaction.editReply('No song is currently playing, so nothing to skip.');
                }
                break;
        case 'current':
            if (queue && queue.currentTrack()) {
                await interaction.editReply(`Now playing: ${queue.currentTrack()}`);
            } else {
                await interaction.editReply('No song is currently playing.');
            }
            break;
        case 'queue':
            if (queue) {
                const upcoming = queue.upcomingTracks();
                if (upcoming.length) {
                    await interaction.editReply(`Next songs:\n${upcoming.join('\n')}`);
                } else {
                    await interaction.editReply('No more songs in the queue.');
                }
            } else {
                await interaction.editReply('No songs in the queue.');
            }
            break;
        }

    } catch (error) {
        console.error("There was an error:", error);
        // Respond to the interaction with an error message if possible
        try {
            await interaction.followUp({ content: 'An error occurred while processing your command.' });
        } catch (followUpError) {
            console.error("Failed to send follow-up:", followUpError);
        }
    }
});

client.login(process.env.BOT_TOKEN);
