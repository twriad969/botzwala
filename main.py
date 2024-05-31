import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import requests
import json
import time
import os
import flask
from threading import Thread

# Read the API token from environment variables
API_TOKEN = os.getenv('TELEGRAM_API_TOKEN')
CHANNEL_USERNAME = '@BotzWala'
ADMIN_IDS = ['6135009699', '1287563568', '6402220718']  # Add another admin ID here

bot = telebot.TeleBot(API_TOKEN)

# Data file to keep track of users and their access
DATA_FILE = 'data.json'
API_FILE = 'api.json'

# Default APIs
APIs = [
    "https://publicearn.com/api?api=c0c3fb3216826b7e107e17b161c06f7fd2c7fe78&url=",
    "https://publicearn.com/api?api=fd0f68b969f0b61e5f274f9a389d3df82faec11e&url="
]

# Load data from file
def load_data(file_path):
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            return json.load(f)
    return {}

# Save data to file
def save_data(data, file_path):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

# Initial data load
data = load_data(DATA_FILE)
api_data = load_data(API_FILE)

# Set default API if not present in file
if 'current_api' not in api_data:
    api_data['current_api'] = APIs[0]
    save_data(api_data, API_FILE)

# Function to toggle the API
def toggle_api():
    current_index = APIs.index(api_data['current_api'])
    new_index = (current_index + 1) % len(APIs)
    api_data['current_api'] = APIs[new_index]
    save_data(api_data, API_FILE)
    return api_data['current_api']

# Check subscription status
def check_subscription(user_id):
    try:
        chat_member = bot.get_chat_member(CHANNEL_USERNAME, user_id)
        return chat_member.status in ['member', 'administrator', 'creator']
    except:
        return False

# Start command handler
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.from_user.id)
    command_args = message.text.split()

    if len(command_args) > 1:
        unique_id = command_args[1]
        stored_id, timestamp = unique_id.split('_')
        if user_id == stored_id:
            data[user_id] = {'verify_time': time.time()}
            save_data(data, DATA_FILE)
            bot.send_message(message.chat.id, "🎉 You have successfully verified! You can use the bot for the next 12 hours.")
            return

    if not check_subscription(user_id):
        markup = InlineKeyboardMarkup()
        subscribe_button = InlineKeyboardButton(text="📢 Subscribe to channel", url=f"https://t.me/BotzWala")
        markup.add(subscribe_button)
        bot.send_message(
            message.chat.id,
            "❗️ Please subscribe to the channel and click /start again to use this bot.",
            reply_markup=markup
        )
        return

    if user_id not in data or data[user_id]['verify_time'] is None:
        data[user_id] = {'verify_time': None}
        save_data(data, DATA_FILE)

    bot.send_message(message.chat.id, "Hello, I am a bot to download videos from Terabox.\n\nJust send me the Terabox link and I will start downloading it for you.\n\nJoin @BotzWala For More Updates")

# Handle Terabox link
@bot.message_handler(regexp="https://(1024terabox|teraboxapp|freeterabox).com/s/")
def handle_terabox_link(message):
    user_id = str(message.from_user.id)

    if not check_subscription(user_id):
        markup = InlineKeyboardMarkup()
        subscribe_button = InlineKeyboardButton(text="📢 Subscribe to channel", url=f"https://t.me/BotzWala")
        markup.add(subscribe_button)
        bot.send_message(
            message.chat.id,
            "❗️ Please subscribe to the channel to use this bot.",
            reply_markup=markup
        )
        return

    if user_id not in data or data[user_id]['verify_time'] is None or time.time() - data[user_id]['verify_time'] > 12 * 60 * 60:
        send_verification_prompt(message)
    else:
        process_terabox_link(message, user_id)

def send_verification_prompt(message):
    user_id = str(message.from_user.id)
    markup = InlineKeyboardMarkup()
    unique_id = f"{user_id}_{int(time.time())}"
    long_url = f"https://telegram.me/{bot.get_me().username}?start={unique_id}"
    short_url = get_short_url(long_url)

    verify_button = InlineKeyboardButton(text="🔑 Click here to verify", url=short_url)
    tutorial_button = InlineKeyboardButton(text="📖 How to verify", url="https://example.com/tutorial")
    markup.add(verify_button)
    markup.add(tutorial_button)

    bot.send_message(
        message.chat.id, 
        "Hello,\n\nIt seems like your Ads token has expired. Please refresh your token and try again.\n\nToken Timeout: 12 hours\n\nWhat is a token?\n\nThis is an Ads token. After viewing 1 ad, you can utilize the bot for the next 12 hours.\n\nKeep the interactions going smoothly 🚀", 
        reply_markup=markup
    )

def get_short_url(long_url):
    api_url = f"{api_data['current_api']}{long_url}"
    response = requests.get(api_url)
    if response.status_code == 200:
        return response.json().get("shortenedUrl")
    return long_url

def process_terabox_link(message, user_id):
    link = message.text
    progress_message = bot.send_message(message.chat.id, "🔄 Requesting API...")
    api_url = f"https://st.ronok.workers.dev/?link={link}"
    response = requests.get(api_url)

    if response.status_code == 200:
        video_url = response.text.strip()
        bot.edit_message_text(chat_id=message.chat.id, message_id=progress_message.id, text="⬇️ Downloading the video...")
        video_filename = download_video(video_url)
        bot.edit_message_text(chat_id=message.chat.id, message_id=progress_message.id, text="⬆️ Uploading the video...")
        bot.send_video(message.chat.id, video=open(video_filename, 'rb'), caption="🎥 Your video is downloaded\n\nJoin @BotzWala For More Updates")
        os.remove(video_filename)
        bot.delete_message(chat_id=message.chat.id, message_id=progress_message.id)
    else:
        bot.edit_message_text(chat_id=message.chat.id, message_id=progress_message.id, text="❌ Failed to process the link.")

def download_video(video_url):
    video_filename = video_url.split('/')[-1]
    response = requests.get(video_url, stream=True)

    with open(video_filename, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    return video_filename

# Admin command to view stats
@bot.message_handler(commands=['ronok'])
def view_stats(message):
    user_id = str(message.from_user.id)
    if user_id in ADMIN_IDS:
        total_users = len(data)
        verified_users = sum(1 for user in data.values() if user['verify_time'] is not None and time.time() - user['verify_time'] <= 12 * 60 * 60)
        bot.send_message(message.chat.id, f"📊 Total users: {total_users}\n✅ Verified users: {verified_users}")
    else:
        bot.send_message(message.chat.id, "🚫 You don't have permission to view the stats.")

# Admin command to broadcast message
@bot.message_handler(commands=['broad'])
def broadcast(message):
    user_id = str(message.from_user.id)
    if user_id in ADMIN_IDS:
        text = message.text.split(' ', 1)[1]
        for user in data.keys():
            try:
                bot.send_message(user, text)
            except:
                pass
    else:
        bot.send_message(message.chat.id, "🚫 You don't have permission to broadcast messages.")

# Admin command to check current API
@bot.message_handler(commands=['api'])
def check_api(message):
    user_id = str(message.from_user.id)
    if user_id in ADMIN_IDS:
        bot.send_message(message.chat.id, f"🔗 Current API: {api_data['current_api']}")
    else:
        bot.send_message(message.chat.id, "🚫 You don't have permission to view the current API.")

# Admin command to change the API
@bot.message_handler(commands=['change'])
def change_api(message):
    user_id = str(message.from_user.id)
    if user_id in ADMIN_IDS:
        new_api = toggle_api()
        bot.send_message(message.chat.id, f"🔄 API has been changed.\n🔗 Current API: {new_api}")
    else:
        bot.send_message(message.chat.id, "🚫 You don't have permission to change the API.")

# Start Flask app for Heroku
app = flask.Flask(__name__)

@app.route('/')
def index():
    return 'Bot is running!'

def start_flask():
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

# Start polling in a separate thread
def start_polling():
    bot.polling()

if __name__ == '__main__':
    Thread(target=start_flask).start()
    Thread(target=start_polling).start()
