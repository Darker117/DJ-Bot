# 🎵 DJ-Bot for Discord


Introduce your Discord server to DJ-Bot, a bot capable of playing music from YouTube and SoundCloud. It offers intuitive slash commands that bring a rich music experience directly to your channels.


## 🚀 Getting Started

Prerequisites

Node.js & npm

Git

Clone the Repository:

```bash
git clone https://github.com/Darker117/DJ-Bot.git
cd DJ-Bot
```
Install Dependencies
```
npm install
```
## Configuration

You will need to set up your environment variables:

Rename .env.example to .env.

Fill in the required fields:
```
YOUTUBE_API_KEY: Your YouTube API key.
SOUNDCLOUD_CLIENT_ID: Your SoundCloud Client ID.
BOT_TOKEN: Your Discord bot token.
GUILD_ID: The ID of your Discord guild.
```
## 🔧 Running the Bot
```
npm start
```
or alternitively you can use
```
node bot.js
```

# 🌐 Hosting the Bot on DigitalOcean

## If you wish to keep the bot running 24/7, consider hosting it on a platform like DigitalOcean.

### Steps:
#### Set Up a DigitalOcean Account:

If you don't have an account, [sign up here.](https://cloud.digitalocean.com/login)

## Create a Droplet:

Choose an image (Ubuntu 20.04 is recommended).

Select a size (The basic one should suffice for a bot).

Choose a data center region closest to the majority of your server members for best performance.

Add your SSH keys for secure access.

Finally, hit the "Create Droplet" button.

## Access Your Droplet:

Once the droplet is set up, SSH into it:
```
ssh root@[Your Droplet's IP Address]
```
## Setup Node.js on Your Droplet:

### Update package list and install prerequisites:
```
sudo apt update
sudo apt install curl
```
Install Node.js:
```
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install nodejs
```
Clone Your Bot Repository:
```
git clone https://github.com/Darker117/DJ-Bot.git
cd DJ-Bot
```
Install Bot Dependencies:
```
npm install
```
## Setup Environment Variables:

As before, set up your .env file with the necessary credentials.

First cp the .env.example file using this command:
```
cp .env.example .env
```
Then nano into it:
```
nano .env
```
Imput your credintals in the approprate fields

Once done press ctrl + x

Then press y and enter to save the newly created .env file

## Run Your Bot:

run the following command in the terminal:
```
screen node bot.js
```
or alternatively 
```
npm start
```
## Optional: 

### Use pm2 to Keep the Bot Running:

If you want the bot to continuously run in the background, use pm2:
```
npm install pm2 -g
pm2 start bot.js --name "DJ-Bot"
```
# 🎛️ Commands
/play [url]: Play a song from YouTube or SoundCloud.

/pause: Pause the currently playing song.

/resume: Resume the paused song.

/skip: Skip the currently playing song.

/current: Display the currently playing song.

/queue: Display the upcoming songs in the queue.

# 🤝 Contributing

Feel free to submit issues or pull requests, any feedback is welcome!

# 📝 License

This project is open source and available under the MIT License.

