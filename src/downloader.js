const process = require('process');

const {
    spawn
} = require('child_process');

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');
const iconv = require('iconv-lite');
const { Markup } = require('telegraf');


const {
    YOUTUBE_URL_REGEX,
    PROGRESS_REGEX,
    PROGRESS_REGEX_NOT_YOUTUBE,
    PAGE_URL_REGEX,
    FORMAT_REGEX,
    DOMAIN_EXTRACTOR_REGEX,
    PLAYLIST_PROGRESS_REGEX,
    UNWANTED_CHARACTERS_IN_FILENAME_REGEX_1,
    UNWANTED_CHARACTERS_IN_FILENAME_REGEX_2
} = require('./constants');

const {
    PER_PAGE,
} = require('./constants');

const {
    getCurrentStreamOptions,
    generateOutputMessage,
    generateMessagePlaylist,
    generateDefaultPaginationKeyboard,
    getVideoTitle
} = require('./libs/tg_helpers');

const {
    buildPaginatedSiteList
} = require('./libs/list_builder');

const {
    getSupportedWebsites,
    getLatestVersion,
    getDownloadLink
} = require('./libs/github_helpers');

const {
    getCurrentTime
} = require('./libs/get_time');


const {
    paginate
} = require('./libs/paginate');

/**
 * Generate full path from environment variable
 * @param  DEFAULT_DOWNLOAD_LOCATION  Default download location, provided inside environment variable
 */
const fullPath = path.resolve(process.env.DEFAULT_DOWNLOAD_LOCATION);

class Downloader {
    constructor()
    {
        this.queue = [];
        this.args = [];
        this.formatOptions = null;
        this.bufferData = null;
        this.format = '';
        this.downloader = null;
        this.info = null;
        this.list = null;
        this.hasAlreadyBeenDownloaded = false;
        this.isBeingExtracted = false;
        this.isPlaylist = false;
        this.isChannel = false;
        this.playlistProgress = null;
        this.downloadedFile = '';
        this.error = '';
        this.currentProcess = null;
    }

    /**
     * Generic callback parser
     * 
     * @param {Context} ctx Telegram Update object
     * @return void
     */
    async handleAction (ctx) 
    {        
        //⬇️ Extracting message_id, chat_id from previous message
        let messageId = ctx.update.callback_query.message.message_id;
        let chatId = ctx.update.callback_query.message.chat.id;
        
        //  Parsing callback data
        let pageUrlMath = ctx.match[0].match(PAGE_URL_REGEX)[0];
        //  Getting integer values for currentPage, PER_PAGE and total
        let [currentPage,,total] = pageUrlMath.match(/\d+/gm);
        
        //  Getting supported websites from github 
        this.list = await getSupportedWebsites();
        
        //  Creating pagination
        let paginatedList = paginate(list, PER_PAGE, currentPage);
        //  Generating message text, based on paginated list
        let messageText = buildPaginatedSiteList(paginatedList);
        
        //  Setting types manually to number 
        currentPage = +currentPage;
        total = +total;
    
        //  Calculating last page
        let lastPage = Math.ceil(total/PER_PAGE);
        let progress = `${currentPage}/${lastPage}`;
    
        const paginationOptions = [progress, currentPage, PER_PAGE, total];
        const tgOptions = [ctx, Markup, chatId, messageId, messageText];
    
        if(pageUrlMath.includes('start'))
        {
            await ctx.answerCbQuery(`Current page: ${currentPage}`);
        }
    
        if(pageUrlMath.includes('next'))
        {
            if(lastPage > currentPage)
            {
                await ctx.answerCbQuery(`Navigating to next page`);            
                await generateDefaultPaginationKeyboard(tgOptions, paginationOptions);
            }
    
            if(currentPage == lastPage)
            {
                ctx.answerCbQuery(`Last page`);            
                await ctx.telegram.editMessageText(chatId, messageId, null, messageText, { parse_mode: 'HTML',...Markup.inlineKeyboard([
                    Markup.button.callback('⬅️', `goto?page=prev&currentPage=${currentPage-1}&perpage=${PER_PAGE}&total=${total}`),
                    Markup.button.callback(progress, `goto?page=start&currentPage=${currentPage}&perpage=${PER_PAGE}&total=${list.length}`),
                ])});
            }
        }
        
        if(pageUrlMath.includes('prev'))
        {
            if(currentPage == 1)
            {
                ctx.answerCbQuery(`First page`);            
                await ctx.telegram.editMessageText(chatId, messageId, null, messageText, { parse_mode: 'HTML',...Markup.inlineKeyboard([
                    Markup.button.callback(progress, `goto?page=start&currentPage=${currentPage}&perpage=${PER_PAGE}&total=${list.length}`),
                    Markup.button.callback('➡️',`goto?page=next&currentPage=${currentPage+1}&perpage=${PER_PAGE}&total=${total}`)
                ])});
            } 
            else 
            {
                ctx.answerCbQuery(`Navigating to previous page`);
                await generateDefaultPaginationKeyboard(tgOptions, paginationOptions);
            }
        }
    }
    
    /**
     * Function that runs each time "/start" button pressed
     * 
     * @param {Context} ctx Telegram Update object
     * @return void
     */
    async handleStart(ctx)
    {
        await ctx.reply(`Hello, ${ctx.update.message.from.username}`, Markup
                                                                        .keyboard([
                                                                            ['Check for the updates 🔄'],
                                                                            ['Check supported websites 🌍'],
                                                                            ['F.A.Q ℹ️']
                                                                        ])
                                                                        .resize());
        this.list = await getSupportedWebsites();
    }
    
    /**
     * Sends the list of supported websites
     * 
     * @param {Context} ctx Telegram Update object
     * @return void
     */
    async handleSupportedWebsites(ctx) 
    {
        let currentPage = 1;
        this.list = await getSupportedWebsites();
        let total = Math.ceil(list.length / PER_PAGE);
        let progress = `${currentPage}/${total}`;
        await ctx.reply(`Total supported websites: ${list.length}`);
        let paginatedList = paginate(list, PER_PAGE, currentPage);
        let messageText = buildPaginatedSiteList(paginatedList);
    
        await ctx.reply(messageText, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                Markup.button.callback(progress, `goto?page=start&currentPage=${currentPage}&perpage=${PER_PAGE}&total=${list.length}`),
                Markup.button.callback('➡️', `goto?page=next&currentPage=${currentPage+1}&perpage=${PER_PAGE}&total=${list.length}`)
            ])
        });
    }
    
    /**
     * Handles update to latest version
     * 
     * @param {Context} ctx Telegram Update object
     * @return void
     */
    async handleUpdate (ctx) 
    {
        //  Checking if we have the latest yt-dlp binary
        let currentVersion;
        let sentMessage = await ctx.reply('Checking ⏳');
        const from_id = sentMessage.chat.id;
    
        this.args.push(['--version']);
    
        this.currentProcess = spawn('yt-dlp',args);
        
        this.currentProcess.stdout.on('data', (data) => {
            currentVersion = data.toString();
        });
        
        this.currentProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data.toString()}`);
        });
        
        this.currentProcess.on('error',(error) => {
            console.log(error);
        });
    
        this.currentProcess.on('close', async (code) => {
            currentVersion = currentVersion.trim();
            this.args = [];
            this.currentProcess = null;
            //  Getting latest available version tag from GitHub
            const latestVersion = await getLatestVersion();
            console.log(chalk.yellow(`child process exited with code ${code}`));
            console.log('currentVersion: ', chalk.black.bgWhite(currentVersion));
            console.log('latestVersion: ', chalk.black.bgGreen(latestVersion));
    
            if(latestVersion != currentVersion)
            {
                ctx.telegram.sendMessage(from_id, "There is an update available 🔄");
                ctx.telegram.sendMessage(from_id, "Updating ⏳")
                
                //  Downloading latest binary
                this.downloadFileFromStream(await getDownloadLink(), getBinaryName(), function(){
                    ctx.telegram.sendMessage(from_id,'App has been updated! ✅')
                });                
            }
            else 
            {
                ctx.telegram.sendMessage(from_id, "Your app is up to date! ✅");
            }
        });
    }
    
    /**
     * Sends an .mp3 version of the video that was request to download 
     * 
     * @param {Context} ctx Telegram Update object 
     * @return void
     */
    async handleAudio (ctx) 
    {
        const messageId = ctx.update.message.message_id;
        
        await ctx.reply('Added to queue!');
    
        this.queue.push({
            id: messageId,
            context: ctx
        })
    
        await this.processQueue(ctx, 'audio');
    }
    
    /**
     * Downloads the requested video 
     * 
     * @param {Context} ctx Telegram Update object 
     * @return void
     */
    async handleVideo (ctx) 
    {
        const messageId = ctx.update.message.message_id;
    
        await ctx.reply('Added to queue!');
    
        this.queue.push({
            id: messageId,
            context: ctx
        });
    
        await this.processQueue(ctx, 'video');
    }
    
    /**
     * Checks cookie file ( if was provided ) for validity
     * 
     * @param {Context} ctx Telegram Update object
     * @return void
     */
    async handleDocument (ctx)
    {
        // User provided cookie file
        const document = ctx.update.message.document;
        const documentId = document.file_id;
        const getFileResponse = await ctx.telegram.getFile(documentId);
        const filePath = getFileResponse.file_path;
        const link = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
        
        //Save file and read its contents
        this.downloadFileFromStream(link, './cookies.txt', async function () {
            try {
                const contents = fs.readFileSync('./cookies.txt', 'utf8');
    
                //Check if it is a valid cookie
                if (contents.includes("# Netscape HTTP Cookie File")) {
                    return await ctx.reply('Valid cookie was provided ✅');
                }
    
                // Invalid cookie was provided, delete the file
                await ctx.reply('Valid cookie was provided ❌');
                fs.rmSync('./cookies.txt');
            } catch (error) {
                console.log('Something happened: ', error);
            }
        });
    }
    
    /**
     * File download function
     * 
     * @param {String} url URL to download
     * @param {String} fileName Filename for saving
     * @param {Function} callback Callback function to be run when file is downloaded
     * @return void
     */
    async downloadFileFromStream (url, fileName, callback)
    {
        const downloadResponse = await axios({
            method: "get",
            url,
            responseType: "stream"
        });
    
        // Saving stream to a file
        const binaryStream = fs.createWriteStream(fileName);
        
        downloadResponse.data.pipe(binaryStream);
        
        binaryStream.on('error', function (err) {
            console.log(chalk.white.bgRed(err))
        })
        
        binaryStream.on('close', function(){
            callback();
        });
    }
    
    /**
     * Queue processing function
     * 
     * @param {Context} ctx Telegram Update Object
     * @param {String} type Type of a file that has been requested
     * @return void
     */
    async processQueue (ctx, type)
    {
        if (this.currentProcess) {
            return;
        }
    
        try {
            while (this.queue.length > 0) {
                let queueItem = this.queue.shift();
    
                switch(type){
                    case 'audio':
                        await this.processAudio(queueItem.context);
                        break;
                    case 'video':
                        await this.processVideo(queueItem.context);                    
                        break;
                }
            }
        } catch (error) {
            console.log(error);
            this.currentProcess = null;
        }
    }
    
    /**
     * Processes and sends the audio (if possible) to the user
     * 
     * @param {Context} ctx Telegram Update Object
     */
    async processAudio ( ctx ) {
        const messageText = ctx.match[1];
        let foundMatches = messageText.match(YOUTUBE_URL_REGEX);
    
        if (foundMatches != null) {
            //Saving message to for using it's id in the future.
            let sentMessage = await ctx.reply('Downloading...'); 
            const message_id = sentMessage.message_id;
            const from_id = sentMessage.chat.id;
            
            args.push(['--add-header'], ['Cookie:COOKIE_STRING_EXTRACTED_FROM_BROWSER'], ['-x'], ['--audio-format'], ['mp3'], messageText);
            args.push([`-P ${fullPath}`]);
            args.push(["-o"], ["mp3/%(title)s.%(ext)s"], messageText);
            /*
                ⬆️ Setting up command-line arguments to extract cookie from the browser 
                    and
                convert video to .mp3 after it has been downloaded
            */
            this.info = `ℹ️ Downloading video as mp3`;
            this.currentProcess = spawn('yt-dlp', args); //Spawning yt-dlp process with arguments
            this.currentProcess.stdout.on('data', async (data) => {
                console.log(data.toString());
                this.bufferData = iconv.decode(data, 'win1251').toString();
    
                if (this.bufferData.includes('ExtractAudio')) {
                    this.downloadedFile = this.bufferData.match(/([A-Z]:.*?\.mp3)/gm)[0];
                    if(this.bufferData.includes('Destination')){
                        this.isBeingExtracted = true;
                        await ctx.telegram.editMessageText(from_id, message_id, null, 'Converting file ⏳');
                    }
                    await ctx.reply('File is already in MP3 format');
                }
            });
    
            //⬇️ Setting up an interval to periodically send messages to telegram
            let tgInterval = setInterval(() => {
                let progressMatches = PROGRESS_REGEX.exec(this.bufferData);
                let message = '';
                if (progressMatches) {
                    message += generateOutputMessage(false, this.info, progressMatches, null);
                    let [currentDate, currentTime] = getCurrentTime();
                    ctx.telegram.editMessageText(from_id, message_id, null, `${message} \n🕐   Current time: ${currentDate} ${currentTime}`);
                }
            }, 500)
    
            //  Listening for data stream from spawned process
            this.currentProcess.stderr.on('data', (data) => {
                console.error(chalk.red(`STD_ERROR: ${data.toString()}`));
            });
    
            //  Listening for errors 
            this.currentProcess.on('error', (error) => {
                console.log('eror', error);
            });
    
            //  Listening for end stream closing
            this.currentProcess.on('close', async (code) => {
                clearInterval(tgInterval); //   Clearing interval so it stops sending messages
                //⬇️ Clearing variables;
                this.args = [];
                this.bufferData = null;
                this.currentProcess = null;
                this.isBeingExtracted = false;
                this.info = '';
                this.currentProcess = null;
                let performer, title;
    
                console.log(chalk.green(`child process exited with code ${code}`));
                await ctx.telegram.editMessageText(from_id, message_id, null, "Downloaded ✅");
                const fileSizeMB = Math.ceil(fs.statSync(this.downloadedFile).size / (Math.pow(1024, 2)));
                //Check if filesize is less than 50mb
                if (fileSizeMB < 50) {
                    if (this.downloadedFile.includes('-')) {
                        let data = path.parse(this.downloadedFile).name.split('-');
                        performer = data[0];
                        title = data[1];
                        performer = performer.trim();
                        title = title.trim().replace(UNWANTED_CHARACTERS_IN_FILENAME_REGEX_1, '').replace(UNWANTED_CHARACTERS_IN_FILENAME_REGEX_2, '');
                    } else {
                        title = 'Unknown title'
                        performer = 'Unknown artist'
                    }
    
                    let sendingFileMessage = await ctx.telegram.sendMessage(from_id, "Sending file ⏳");
                    
                    await ctx.telegram.sendAudio(from_id, {
                        source: fs.readFileSync(path.resolve(fullPath, this.downloadedFile))
                    }, {
                        title,
                        performer
                    });
                    await ctx.telegram.editMessageText(sendingFileMessage.chat.id, sendingFileMessage.message_id, null, 'File sent ✅')
                } else {
                    // TODO: Sent links on the server to download, instead of sending file 
                    await ctx.reply(`File is too big: ${fileSizeMB}MB\nUnable to send 🚫`);
                }
                fs.unlinkSync(path.resolve(fullPath, this.downloadedFile));
            });
        } else {
            await ctx.reply('Please provide a YouTube video link!');
        }
    }
    
    /**
     * Processes and sends the video (if possible) to the user
     * 
     * @param {Context} ctx Telegram Update Object
     */
    async processVideo (ctx)
    {
        const messageId = ctx.update.message.message_id;
        const messageText = ctx.match[1];
    
        await ctx.reply('Checking available formats ⏳');
    
        let foundMatches = messageText.match(YOUTUBE_URL_REGEX);
    
        if (foundMatches != null) {
            let outputStr = '';
            this.args.push(['-F'], ['--get-title'], messageText);
    
            //  Checking available formats
            this.currentProcess = spawn('yt-dlp', this.args);
    
            this.currentProcess.stdout.on('data', (data) => {
                console.log(data.toString());
                outputStr += data.toString();
            });
    
            this.currentProcess.on('error', (error) => {
                console.error(error);
            });
    
            this.currentProcess.on('close', async (code) => {
                this.args = [];
                this.info = '';
                this.currentProcess = null;
    
                // Parsing results after checking available formats
                this.formatOptions = getCurrentStreamOptions(outputStr);
                let videoTitle = getVideoTitle(outputStr);
    
                // Start downloading          
                this.args.push(['--add-header'], ['Cookie:COOKIE_STRING_EXTRACTED_FROM_BROWSER'], messageText);
                this.args.push([`-P ${fullPath}`]);
    
                /*
                   Checking if provided link is a playlist,
                   saving each video from the playlist 
                   to the folder with the playlist name
                */
    
                if (messageText.includes('playlist')) {
                    this.info = `ℹ️ Downloading Youtube playlist`;
                    this.isPlaylist = true;
                    this.args.push(["-o"], ["Youtube Video/%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s"]);
                }
    
                /*
                   Checking if provided link is a channel link,
                   saving each video from the channel 
                   to the folder with the channel name
                */
    
                if (messageText.includes('/c/') || messageText.includes('/user/')) {
                    this.info = `ℹ️ Downloading Youtube channel`;
                    this.isChannel = true;
                    this.args.push(["-o"], ["Youtube Video/%(uploader)s/%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s"]);
                }
    
                // Checking if it's just a single video link
                if (messageText.includes('watch?') || messageText.includes('youtu.be')) {
                    this.info += `Downloading single Youtube video\n\n`;
                    this.info += `ℹ️  ${videoTitle}\n`;
                    this.args.push([`-o`], [`Youtube Video/%(title)s.%(ext)s`]);        
                }
    
                let sentMessage = await ctx.reply('Downloading...');
                let message_id = sentMessage.message_id;
                let from_id = sentMessage.chat.id;
    
                this.currentProcess = spawn('yt-dlp', this.args);
    
                this.currentProcess.stdout.on('data', (data) => {
                    this.bufferData = data.toString();
    
                    if (this.bufferData.includes('Destination'))
                    {
                        //  Extracting format id from currently downloading stream
                        this.format = this.bufferData.match(FORMAT_REGEX)[0].slice(1);
                    }
    
                    if (this.bufferData.includes('Finished downloading playlist:'))
                    {
                        this.currentProcess.kill('SIGTERM')
                    }
    
                    if (this.bufferData.includes("has already been downloaded"))
                    {
                        this.hasAlreadyBeenDownloaded = true;
                    }
    
                    if (this.bufferData.match(PLAYLIST_PROGRESS_REGEX)) 
                    {
                        this.playlistProgress = this.bufferData.match(PLAYLIST_PROGRESS_REGEX)[0].trim();
                        this.isPlaylist = true;
                    }
    
                    console.log(chalk.green(this.bufferData));
                });
    
                let tgInterval = setInterval(() => {
                    let progressMatches = PROGRESS_REGEX.exec(this.bufferData);
                    let message = '';
                    if (this.format != '') 
                    {
                        //  Iterating over parsed format options to find our current format
                        let foundFormatData = this.formatOptions.find((item) => item[0] == this.format);
    
                        if (progressMatches) 
                        {
                            if (this.isPlaylist || this.isChannel) {
                                message += generateMessagePlaylist(this.playlistProgress, this.info, progressMatches, foundFormatData);
                            } else {
                                message += generateOutputMessage(true, this.info, progressMatches, foundFormatData);
                            }
    
                            //  You can change the date for your needs, I had to add +4 hrs to correctly display Azerbaijan time
                            let [currentDate, currentTime] = getCurrentTime();
                            ctx.telegram.editMessageText(from_id, message_id, null, `${message} \n🕐   Current time: ${currentDate} ${currentTime}`);
                        }
                    }
    
                }, 500)
    
                this.currentProcess.stderr.on('data', (data) => {
                    this.error = data.toString();
                    console.error(chalk.red(`stderr: ${data.toString()}`));
                });
    
                this.currentProcess.on('error', (error) => {
                    console.log(chalk.red(error));
                });
    
                this.currentProcess.on('close', async (code) => {
                    console.log(chalk.yellow(`child process exited with code ${code}`));
    
                    // Clearing all variables
                    clearInterval(tgInterval);
                    this.args = [];
                    this.bufferData = null;
                    this.currentProcess = null;
                    this.isPlaylist = false;
                    this.info = '';
                    this.videoTitle = '';
    
                    if (this.error.length === 0) {
                        await ctx.telegram.editMessageText(from_id, message_id, null, `Downloaded! ✅`);
    
                        //extract last queue item from queue
                        const lastQueueItem = this.queue[this.queue.length - 1];
    
                        if (lastQueueItem) {
                            this.processVideo(lastQueueItem.context);
                            //remove video from the queue
                            this.queue = this.queue.filter((video) => video.id !== messageId);
                            await ctx.reply('Processing next entry in the queue...');
                        }
                    } else {
                        await ctx.telegram.editMessageText(from_id, message_id, null, `An error occured 🚫`);
                        error = '';
                    }
                });
            });
        } else {
            // Downloading any other video
            let domain;
            let videoTitle;
            /* 
                Extracting the main domain from the link that was sent
            */
            const domainMatches = DOMAIN_EXTRACTOR_REGEX.exec(messageText);
    
            if (domainMatches) {
                domain = domainMatches[1].match(/[a-zA-Z]+/img)[0];
            }
    
            DOMAIN_EXTRACTOR_REGEX.lastIndex = 0;
    
            this.info = `ℹ️ Downloading ${domain} video`;
            this.args.push(['--cookies'], ['cookies.txt'], [`-P ${fullPath}`]);
    
            /*
                Adding extractor variable to output folder template,
                so each video will be downloaded in corresponding folder
            */
            this.args.push(['-o'], ['%(extractor)s/%(title)s.%(ext)s']);
            this.args.push(messageText);
    
            let sentMessage = await ctx.reply('Downloading...');
            let message_id = sentMessage.message_id;
            let from_id = sentMessage.chat.id;
            
            if(!videoTitle){
                videoTitle = await getVideoTitle(messageText);
                this.info += `\n\n📍  ${videoTitle}`;
            }
    
            this.currentProcess = spawn('yt-dlp', this.args);
    
            this.currentProcess.stdout.on('data', async (data) => {
                this.bufferData = data.toString();
                console.log(chalk.green(this.bufferData));
                
                if (this.bufferData.includes("has already been downloaded")) {
                    this.hasAlreadyBeenDownloaded = true;
                }
            });
    
            this.currentProcess.on('error', (error) => {
                console.log(chalk.red(error));
            });
    
            let tgInterval = setInterval(() => {
                let progressMatches = PROGRESS_REGEX_NOT_YOUTUBE.exec(this.bufferData);
                let message = '';
                if (progressMatches) {
                    
                    message += generateOutputMessage(null, this.info, progressMatches, null);
                    let [currentDate, currentTime] = getCurrentTime();
                    ctx.telegram.editMessageText(from_id, message_id, null, `${message} \n🕐   Current time: ${currentDate} ${currentTime}`);
                }
            }, 500)
    
            this.currentProcess.stderr.on('data', (data) => {
                data = data.toString();
                this.error = data;
                console.log(chalk.red(`stderrr => : ${data}`));
            });
    
            this.currentProcess.on('error', (error) => {
                console.log(chalk.red(error));
            });
    
            this.currentProcess.on('close', async (code) => {
                console.log(chalk.yellow(`child process exited with code ${code}`));
                
                // Clearing all variables
                clearInterval(tgInterval);
                this.args = [];
                this.bufferData = null;
                this.currentProcess = null;
                this.info = '';
    
                if (this.error.length === 0 || this.error.includes('WARNING')) {
                    if (!this.hasAlreadyBeenDownloaded) {
                        await ctx.telegram.editMessageText(from_id, message_id, null, `Downloaded! ✅`);
                    } else {
                        await ctx.telegram.editMessageText(from_id, message_id, null, `Already downloaded ℹ️`);
                    }
    
                    //extract last queue item from queue
                    const lastQueueItem = this.queue[this.queue.length - 1];
    
                    if (lastQueueItem) {
                        this.processVideo(lastQueueItem.context);
                        //remove video from the queue
                        this.queue = this.queue.filter((video) => video.id !== messageId);
                        await ctx.reply('Processing next entry in the queue...');
                    }
                } else {
                    await ctx.telegram.editMessageText(from_id, message_id, null, `An error occured 🚫`);
                    this.error = '';
                }
            });
        }
    
        await new Promise((resolve, reject) => {
            this.currentProcess.on('exit', resolve);
            this.currentProcess.on('error', reject);
        });
    }
}

module.exports = Downloader;