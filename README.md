# RSS Watcher Bot

A Telegram bot to manage RSS subscriptions.

## Features

- Add RSS feeds to your subscription list.
- List your current subscriptions.
- Unsubscribe from feeds.
- Receive notifications for new content every 15 minutes.

## Setup

1.  Clone this repository.
2.  Install the dependencies:

    ```
    npm install
    ```

3.  Create a `.env` file in the root of the project and add your Telegram bot token:

    ```
    BOT_TOKEN=your_bot_token
    ```

4.  Start the bot:

    ```
    node index.js
    ```

## Usage

- `/start` - Welcome message and instructions.
- `/add <feed_url>` - Add a new RSS feed.
- `/list` - List your subscriptions and unsubscribe.
- `/remove` - Alias for `/list`.

## Running with Docker

1.  Create a `.env` file in the root of the project and add your Telegram bot token:

    ```
    BOT_TOKEN=your_bot_token
    ```

2.  Build and run the container using Docker Compose:

    ```
    docker-compose up -d --build
    ```
