const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Express server
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Telegram bot is running!'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Bot Token
const API_TOKEN = process.env.API_TOKEN || '7198843527:AAE7CVIf6zaByCnbPz-OLsyrwZQSqo8SxZU';
const CHANNEL_USERNAME = '@botzwala';
const ADMIN_IDS = ['6135009699', '1287563568', '6402220718']; // Add another admin ID here

const bot = new TelegramBot(API_TOKEN, { polling: true });

// External API for user data
const USER_DATA_API = 'https://mlobd.online/data/';

// Load data from API
const loadData = async () => {
    try {
        const response = await axios.get(USER_DATA_API);
        return response.data || {};
    } catch (error) {
        console.error('Error loading data:', error.message);
        return {};
    }
};

// Save data to API
const saveData = async (data) => {
    try {
        await axios.post(USER_DATA_API, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error saving data:', error.message);
    }
};

// Initial data load
let data = {};

const init = async () => {
    data = await loadData();

    // Set default API if not present in file
    if (!data.apiData) {
        data.apiData = { current_api: "https://inshorturl.com/api?api=c16399f5b56cce74ff65e7b2763bf42b3d63e865&url=" };
        await saveData(data);
    }
};

// Function to toggle the API
const toggleApi = async () => {
    const APIs = [
        "https://inshorturl.com/api?api=c16399f5b56cce74ff65e7b2763bf42b3d63e865&url=",
        "https://publicearn.com/api?api=fd0f68b969f0b61e5f274f9a389d3df82faec11e&url="
    ];
    const currentIndex = APIs.indexOf(data.apiData.current_api);
    const newIndex = (currentIndex + 1) % APIs.length;
    data.apiData.current_api = APIs[newIndex];
    await saveData(data);
    return data.apiData.current_api;
};

// Check subscription status
const checkSubscription = async (userId) => {
    try {
        const chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        return false;
    }
};

// Start command handler
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id.toString();
    const commandArgs = msg.text.split(" ");

    if (commandArgs.length > 1) {
        const uniqueId = commandArgs[1];
        const [storedId, timestamp] = uniqueId.split('_');
        if (userId === storedId) {
            data[userId] = { verify_time: Date.now() };
            await saveData(data);
            bot.sendMessage(msg.chat.id, "🎉 You have successfully verified! You can use the bot for the next 12 hours.");
            return;
        }
    }

    if (!(await checkSubscription(userId))) {
        const subscribeButton = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📢 Subscribe to channel", url: `https://t.me/botzwala` }]
                ]
            }
        };
        bot.sendMessage(
            msg.chat.id,
            "❗️ Please subscribe to the channel and click /start again to use this bot.",
            subscribeButton
        );
        return;
    }

    if (!data[userId] || !data[userId].verify_time) {
        data[userId] = { verify_time: null };
        await saveData(data);
    }

    bot.sendMessage(msg.chat.id, "Hello, I am a bot to download videos from Terabox.\n\nJust send me the Terabox link and I will start downloading it for you.\n\nJoin @botzwala For More Updates");
});

bot.onText(/https:\/\/(www\.)?(1024terabox|teraboxapp|freeterabox|mirrobox|nephobox|1024tera|4funbox|momerybox|tibibox|terabox|terabox\.app|terabox\.fun|teraboxapp|teraboxapp)\.com\/s\//, async (msg) => {
    const userId = msg.from.id.toString();

    if (!(await checkSubscription(userId))) {
        const subscribeButton = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📢 Subscribe to channel", url: `https://t.me/botzwala` }]
                ]
            }
        };
        bot.sendMessage(
            msg.chat.id,
            "❗️ Please subscribe to the channel to use this bot.",
            subscribeButton
        );
        return;
    }

    if (!data[userId] || !data[userId].verify_time || Date.now() - data[userId].verify_time > 12 * 60 * 60 * 1000) {
        sendVerificationPrompt(msg);
    } else {
        processTeraboxLink(msg, userId);
    }
});

const sendVerificationPrompt = async (msg) => {
    const userId = msg.from.id.toString();
    const uniqueId = `${userId}_${Date.now()}`;
    const longUrl = `https://telegram.me/TeraboxBZWBot?start=${uniqueId}`;
    const shortUrl = await getShortUrl(longUrl);

    const verifyButton = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔑 Click here to verify", url: shortUrl }],
                [{ text: "📖 How to verify", url: "https://t.me/OpenLinksTutorial/3" }]
            ]
        }
    };

    bot.sendMessage(
        msg.chat.id, 
        "Hello,\n\nIt seems like your Ads token has expired. Please refresh your token and try again.\n\nToken Timeout: 12 hours\n\nWhat is a token?\n\nThis is an Ads token. After viewing 1 ad, you can utilize the bot for the next 12 hours.\n\nKeep the interactions going smoothly 🚀", 
        verifyButton
    );
};

const getShortUrl = async (longUrl) => {
    const apiUrl = `${data.apiData.current_api}${longUrl}`;
    try {
        const response = await axios.get(apiUrl);
        if (response.status === 200 && response.data.shortenedUrl) {
            return response.data.shortenedUrl;
        }
    } catch (error) {
        console.error("Error shortening URL:", error.message);
    }
    return longUrl;
};

const processTeraboxLink = async (msg, userId) => {
    const link = msg.text;
    const progressMessage = await bot.sendMessage(msg.chat.id, "🔄 Requesting API...");
    const apiUrl = `https://st.ronok.workers.dev/?link=${link}`;
    try {
        const response = await axios.get(apiUrl);
        if (response.status === 200) {
            const videoUrl = response.data.trim();
            await bot.editMessageText("⬇️ Downloading the video...", { chat_id: msg.chat.id, message_id: progressMessage.message_id });
            const videoFilename = await downloadVideo(videoUrl);
            await bot.editMessageText("⬆️ Uploading the video...", { chat_id: msg.chat.id, message_id: progressMessage.message_id });
            await bot.sendVideo(msg.chat.id, videoFilename, { caption: "🎥 Your video is downloaded\n\nJoin @terabox_video_down For More Updates" });
            fs.unlinkSync(videoFilename);
            await bot.deleteMessage(msg.chat.id, progressMessage.message_id);

            // Track processed links
            if (!data[userId].processed_links) {
                data[userId].processed_links = 0;
            }
            data[userId].processed_links += 1;
            await saveData(data);
        } else {
            await bot.editMessageText("❌ Failed to process the link. ", { chat_id: msg.chat.id, message_id: progressMessage.message_id });
        }
    } catch (error) {
        await bot.editMessageText("❌ Failed to process the link.", { chat_id: msg.chat.id, message_id: progressMessage.message_id });
    }
};

const downloadVideo = async (videoUrl) => {
    const videoFilename = path.basename(videoUrl);
    const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
    });
    const writer = fs.createWriteStream(videoFilename);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(videoFilename));
        writer.on('error', reject);
    });
};

// Admin command to view stats
bot.onText(/\/ronok/, async (msg) => {
    const userId = msg.from.id.toString();
    if (ADMIN_IDS.includes(userId)) {
        const totalUsers = Object.keys(data).length;
        const verifiedUsers = Object.values(data).filter(user => user.verify_time && (Date.now() - user.verify_time <= 12 * 60 * 60 * 1000)).length;
        const totalProcessedLinks = Object.values(data).reduce((acc, user) => acc + (user.processed_links || 0), 0);
        bot.sendMessage(msg.chat.id, `📊 Total users: ${totalUsers}\n✅ Verified users: ${verifiedUsers}\n🔗 Processed links: ${totalProcessedLinks}`);
    } else {
        bot.sendMessage(msg.chat.id, "🚫 You don't have permission to view the stats.");
    }
});

// Admin command to broadcast message
bot.onText(/\/broad (.+)/, async (msg, match) => {
    const userId = msg.from.id.toString();
    if (ADMIN_IDS.includes(userId)) {
        const text = match[1];
        for (const user of Object.keys(data)) {
            bot.sendMessage(user, text).catch(err => console.error(err));
        }
    } else {
        bot.sendMessage(msg.chat.id, "🚫 You don't have permission to broadcast messages.");
    }
});

// Admin command to check current API
bot.onText(/\/api/, (msg) => {
    const userId = msg.from.id.toString();
    if (ADMIN_IDS.includes(userId)) {
        bot.sendMessage(msg.chat.id, `🔗 Current API: ${data.apiData.current_api}`);
    } else {
        bot.sendMessage(msg.chat.id, "🚫 You don't have permission to view the current API.");
    }
});

// Admin command to change API
bot.onText(/\/change/, async (msg) => {
    const userId = msg.from.id.toString();
    if (ADMIN_IDS.includes(userId)) {
        const newApi = await toggleApi();
        bot.sendMessage(msg.chat.id, `🔄 API has been changed.\n🔗 Current API: ${newApi}`);
    } else {
        bot.sendMessage(msg.chat.id, "🚫 You don't have permission to change the API.");
    }
});

// Admin command to reset verification
bot.onText(/\/reset/, async (msg) => {
    const userId = msg.from.id.toString();
    if (ADMIN_IDS.includes(userId)) {
        for (const user of Object.keys(data)) {
            data[user].verify_time = null;
        }
        await saveData(data);
        bot.sendMessage(msg.chat.id, "🔄 All user verifications have been reset.");
    } else {
        bot.sendMessage(msg.chat.id, "🚫 You don't have permission to reset verifications.");
    }
});

// Initialize data on start
init();
