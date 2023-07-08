# Downloader Bot - DEV

## Features

- Uses [Telegraf.js](https://telegraf.js.org/) framework
- Downloads from various websites such as YouTube, Facebook, Reddit and etc.
- Ability to download YouTube music videos directly to .mp3
- Rich UI to show statistics of each downloadable file.
- Automatic channel / playlist detection for YouTube.
- Provided the cookie is present, ability to bypass restrictions .

## Prerequisites

| Prerequisites |
|:-------------:|
| [Node JS](https://nodejs.org/en/download/) |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp)     |
| [ffmpeg](https://ffmpeg.org/download.html)     |

## Installation

- Clone the repo or download the `.zip` file
  - If you downloaded `.zip` file, unpack it anywhere you want.
- Create `.env` file or copy `.env.example` and enter the following variables:
  - `BOT_TOKEN` - Token of your Telegram bot
  - `ME` - Obtain `from_id` of your profile ( it will be used, so no one but you can access the bot )
  - `DEFAULT_DOWNLOAD_LOCATION` - Download folder. E.g: `C:\/Downloads\/`
  - `TELEGRAPH_TOKEN` ^optional^ - Telegra.ph token

- Run `npm install` to install all necessary node modules.
