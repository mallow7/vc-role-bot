const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('VC Role Bot is online!');
});

client.on('message', message => {
  // Add role to everyone
  if (message.content === '!approvevc') {
    if (message.member.roles.cache.has('1468453734555193344') || message.member.roles.cache.has('MOD_ROLE_ID')) {
      const role = message.guild.roles.cache.get('1471004264703856671');
      if (role) {
        message.guild.members.cache.forEach(member => {
          member.roles.add(role).catch(console.error);
        });
        message.channel.send('VC Perms role added to everyone—users can join #Moderated-VC.');
      } else {
        message.reply('VC Perms role not found.');
      }
    } else {
      message.reply('You need Staff or Mod role.');
    }
  }

  // Remove role from everyone
  if (message.content === '!lockvc') {
    if (message.member.roles.cache.has('1468453734555193344') || message.member.roles.cache.has('MOD_ROLE_ID')) {
      const role = message.guild.roles.cache.get('1471004264703856671');
      if (role) {
        message.guild.members.cache.forEach(member => {
          member.roles.remove(role).catch(console.error);
        });
        message.channel.send('VC Perms role removed from everyone—#Moderated-VC is locked.');
      } else {
        message.reply('VC Perms role not found.');
      }
    } else {
      message.reply('You need Staff or Mod role.');
    }
  }
});

client.login(process.env.BOT_TOKEN);
