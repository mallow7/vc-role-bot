const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;  // Render sets PORT; fallback to 10000 for local testing

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,  // For role management
    GatewayIntentBits.MessageContent,  // Privileged intent for reading messages (enable in Discord Developer Portal)
    GatewayIntentBits.GuildVoiceStates  // For voice channel events
  ]
});

// Maps and sets for state management
const activeRequests = new Map();
const vcApproved = new Map();
const activeCommands = new Set();
const processedMessages = new Set();
const lastMessageTime = new Map();

// Cleanup processed messages periodically to prevent memory leaks (optional but good for long-running bots)
setInterval(() => {
  processedMessages.clear();  // Clear every hour; adjust as needed
}, 60 * 60 * 1000);

client.on('ready', () => {
  console.log('VC Role Bot is online!');
  console.log(`Logged in as ${client.user.tag}`);
});

// Global error handling to prevent crashes
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);  // Exit to restart on Render
});

// Express server for health checks and uptime
app.listen(port, () => {
  console.log(`Web server is running on port ${port}`);
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>VC Role Bot</title></head>
      <body>
        <h1>VC Role Bot is Running!</h1>
        <p>Status: ${client.user ? 'Online' : 'Offline'}</p>
        <p>Use !requestvc to request, !approvevc to approve, !joinvc to join, !lockvc to lock.</p>
        <p>Last updated: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
});

client.on('messageCreate', async (message) => {  // Made async for better error handling
  try {
    if (message.author.id === client.user.id) return;

    // Check if message has already been processed
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);

    // Bot listener for YAGPDB's request message
    if (message.author.bot && message.author.id === '204255221017214977' && message.channel.id === '769855036876128257' && message.content.includes('has requested a moderated voice channel session')) {
      if (activeRequests.has(message.guild.id)) return;
      const timeout = setTimeout(() => {
        message.channel.send(`${message.author}, your VC request has been automatically denied due to no staff response in 10 minutes.`);
        activeRequests.delete(message.guild.id);
      }, 10 * 60 * 1000);
      activeRequests.set(message.guild.id, timeout);
      await message.reply('VC request submitted. Auto-deny in 10 minutes if not approved.');
    }

    // Allow user commands in the two specified channels
    const allowedChannels = ['769855036876128257', '1471682252537860213'];
    if (!allowedChannels.includes(message.channel.id)) return;

    // User command for !requestvc
    if (message.content === '!requestvc') {
      if (activeRequests.has(message.guild.id)) {
        await message.reply('You already have an active VC request. Wait for approval or denial.');
        return;
      }
      const timeout = setTimeout(() => {
        message.channel.send(`${message.author}, your VC request has been automatically denied due to no staff response in 10 minutes.`);
        activeRequests.delete(message.guild.id);
      }, 10 * 60 * 1000);
      activeRequests.set(message.guild.id, timeout);
      await message.reply('VC request submitted. Auto-deny in 10 minutes if not approved.');
    }

    if (message.content === '!approvevc') {
      if (!message.member.roles.cache.has('769628526701314108') && !message.member.roles.cache.has('1437634924386451586')) {
        await message.reply('You need Staff or Mod role.');
        return;
      }
      const commandKey = `approve-${message.guild.id}`;
      if (activeCommands.has(commandKey)) {
        await message.reply('Command already in progress. Please wait.');
        return;
      }
      activeCommands.add(commandKey);
      const isApproved = vcApproved.get(message.guild.id);
      if (isApproved === true) {
        activeCommands.delete(commandKey);
        await message.reply('VC is already approved.');
        return;
      }
      const lastTimeKey = `approve-${message.guild.id}`;
      const now = Date.now();
      const lastTime = lastMessageTime.get(lastTimeKey) || 0;
      if (now - lastTime < 3000) {
        activeCommands.delete(commandKey);
        await message.reply('Approval message sent recently. Please wait.');
        return;
      }
      if (activeRequests.has(message.guild.id)) {
        clearTimeout(activeRequests.get(message.guild.id));
        activeRequests.delete(message.guild.id);
      }
      vcApproved.set(message.guild.id, true);
      lastMessageTime.set(lastTimeKey, now);
      await message.channel.send('VC session approved—users can now use !joinvc to join #VC 1.');
      setTimeout(() => activeCommands.delete(commandKey), 1000);
    }

    if (message.content === '!joinvc') {
      const isApproved = vcApproved.get(message.guild.id) || false;
      const isStaffOrMod = message.member.roles.cache.has('769628526701314108') || message.member.roles.cache.has('1437634924386451586');
      
      if (!isApproved && !isStaffOrMod) {
        await message.reply('VC is not approved yet. Wait for staff to run !approvevc.');
        return;
      }
      
      const role = message.guild.roles.cache.get('1471376746027941960');
      if (!role) {
        await message.reply('VC Perms role not found.');
        return;
      }
      if (message.member.roles.cache.has('1471376746027941960')) {
        await message.reply('You already have the VC perms role.');
        return;
      }
      await message.member.roles.add(role);
      await message.reply('VC perms role added—you can now join #VC 1.');
    }

    if (message.content === '!lockvc') {
      if (!message.member.roles.cache.has('769628526701314108') && !message.member.roles.cache.has('1437634924386451586')) {
        await message.reply('You need Staff or Mod role.');
        return;
      }
      const commandKey = `lock-${message.guild.id}`;
      if (activeCommands.has(commandKey)) {
        await message.reply('Command already in progress. Please wait.');
        return;
      }
      activeCommands.add(commandKey);
      console.log(`Locking VC for guild ${message.guild.id}. Total members: ${message.guild.members.cache.size}`);
      const lastTimeKey = `lock-${message.guild.id}`;
      const now = Date.now();
      const lastTime = lastMessageTime.get(lastTimeKey) || 0;
      if (now - lastTime < 3000) {
        activeCommands.delete(commandKey);
        await message.reply('Lock message sent recently. Please wait.');
        return;
      }
      if (activeRequests.has(message.guild.id)) {
        clearTimeout(activeRequests.get(message.guild.id));
        activeRequests.delete(message.guild.id);
      }
      vcApproved.set(message.guild.id, false);
      const role = message.guild.roles.cache.get('1471376746027941960');
      const vcChannel = message.guild.channels.cache.get('769855238562643968');
      if (!role) {
        console.log('VC Perms role not found.');
        await message.reply('VC Perms role not found.');
        activeCommands.delete(commandKey);
        return;
      }
      // Improved: Filter members instead of looping all (better performance)
      const membersToProcess = message.guild.members.cache.filter(member => {
        const isStaff = member.roles.cache.has('769628526701314108');
        const isMod = member.roles.cache.has('1437634924386451586');
        const isBot = member.id === '1470584024882872430';
        return !isStaff && !isMod && !isBot;
      });
      for (const member of membersToProcess.values()) {
        console.log(`Processing member ${member.user.tag} (ID: ${member.id})`);
        try {
          await member.roles.remove(role);
          console.log(`Removed role from ${member.user.tag}`);
          // Disconnect only if in the VC channel
          if (vcChannel && member.voice.channelId === vcChannel.id) {
            await member.voice.disconnect();
            console.log(`Disconnected ${member.user.tag} from VC`);
          }
        } catch (err) {
          console.error(`Failed to process ${member.user.tag}: ${err}`);
        }
      }
      lastMessageTime.set(lastTimeKey, now);
      await message.channel.send('VC session locked—#VC 1 is now closed. Only staff and mods can join.');
      setTimeout(() => activeCommands.delete(commandKey), 1000);
    }
  } catch (error) {
    console.error('Error in messageCreate:', error);
  }
});

client.login(process.env.BOT_TOKEN);
