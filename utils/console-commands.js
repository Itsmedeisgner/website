const { EmbedBuilder } = require('discord.js');

class ConsoleCommands {
    constructor(client) {
        if (!client) throw new Error('Client must be provided to ConsoleCommands');
        this.client = client;
        this.commands = {
            'help': this.showHelp.bind(this),
            'kick-voice': this.kickFromVoice.bind(this),
            'list-voice': this.listVoiceMembers.bind(this),
            'stats': this.showStats.bind(this),
            'broadcast': this.broadcast.bind(this),
            'clear-voice': this.clearVoiceChannel.bind(this),
            'nickname': this.changeNickname.bind(this),
            'reset-nick': this.resetNickname.bind(this),
            'server-mute': this.serverMute.bind(this),
            'server-unmute': this.serverUnmute.bind(this),
            'server-deafen': this.serverDeafen.bind(this),
            'server-undeafen': this.serverUndeafen.bind(this),
            'move-voice': this.moveVoice.bind(this),
        };
    }

    init() {
        console.log('📟 Terminal Control System Initialized');
        console.log('Type "help" to see available commands');
        
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', async (data) => {
            const input = data.trim();
            const [command, ...args] = input.split(' ');
            
            if (this.commands[command]) {
                try {
                    await this.commands[command](args);
                } catch (error) {
                    console.error('Error executing command:', error);
                }
            } else {
                console.log('❌ Unknown command. Type "help" to see available commands.');
            }
        });
    }

    async showHelp() {
        console.log(`
🤖 Bot Terminal Control System
Available Commands:
• help - Show this help message
• kick-voice <guildId> <channelId> <userId> [reason] - Kick user from voice channel
• list-voice <guildId> [channelId] - List users in voice channels
• stats - Show bot statistics
• broadcast <guildId> <message> [--delete=seconds] - Send DM to all server members with optional auto-delete
• clear-voice <guildId> <channelId> - Disconnect all users from voice channel
• nickname <guildId> <userId> <newNickname> - Change a member's nickname
• reset-nick <guildId> <userId> - Reset a member's nickname to their username
• server-mute <guildId> <userId> [reason] - Server mute a user in voice channels
• server-unmute <guildId> <userId> [reason] - Remove server mute from a user
• server-deafen <guildId> <userId> [reason] - Server deafen a user in voice channels
• server-undeafen <guildId> <userId> [reason] - Remove server deafen from a user
• move-voice <guildId> <userId> <targetChannelId> [reason] - Move user to another voice channel

Examples:
• broadcast 123456789 Hello everyone! --delete=30  (message deletes after 30 seconds)
• broadcast 123456789 This is a permanent message
• move-voice 123456789 987654321 456789123 Moving to correct channel
        `);
    }

    async kickFromVoice([guildId, channelId, userId, ...reasonArr]) {
        const reason = reasonArr.join(' ') || 'Kicked via terminal';
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            if (!member.voice.channel || member.voice.channel.id !== channelId) {
                console.log('❌ User is not in the specified voice channel');
                return;
            }

            await member.voice.disconnect(reason);
            console.log(`✅ Kicked ${member.user.tag} from voice channel`);

            // Log the action
            await this.client.logManager.logModAction(
                guild,
                'VOICE_KICK',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: reason
                }
            );
        } catch (error) {
            console.error('Failed to kick user:', error);
        }
    }

    async listVoiceMembers([guildId, channelId]) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const voiceChannels = channelId ? 
                [guild.channels.cache.get(channelId)] : 
                guild.channels.cache.filter(c => c.type === 2);

            console.log(`\n📊 Voice Channels in ${guild.name}:`);
            
            for (const channel of voiceChannels.values()) {
                if (!channel) continue;
                
                console.log(`\n${channel.name} (${channel.id}):`);
                if (channel.members.size === 0) {
                    console.log('  • Empty');
                    continue;
                }

                channel.members.forEach(member => {
                    const status = [
                        member.voice.mute ? '🔇' : '🔊',
                        member.voice.deaf ? '🔕' : '🔔',
                        member.voice.streaming ? '🎥' : '',
                        member.voice.selfVideo ? '📹' : ''
                    ].filter(Boolean).join(' ');

                    console.log(`  • ${member.user.tag} (${member.user.id}) ${status}`);
                });
            }
        } catch (error) {
            console.error('Failed to list voice members:', error);
        }
    }

    async showStats() {
        const stats = {
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            channels: this.client.channels.cache.size,
            voiceConnections: Array.from(this.client.guilds.cache.values())
                .reduce((acc, guild) => acc + guild.channels.cache
                    .filter(c => c.type === 2 && c.members.size > 0)
                    .reduce((acc, vc) => acc + vc.members.size, 0), 0)
        };

        console.log(`
📊 Bot Statistics:
• Servers: ${stats.guilds}
• Users: ${stats.users}
• Channels: ${stats.channels}
• Voice Users: ${stats.voiceConnections}
• Uptime: ${Math.floor(this.client.uptime / 1000 / 60)} minutes
        `);
    }

    async broadcast([guildId, ...messageArr]) {
        let deleteAfter = null;

        // Check for delete flag
        if (messageArr[messageArr.length - 1].startsWith('--delete=')) {
            const seconds = parseInt(messageArr[messageArr.length - 1].split('=')[1]);
            if (!isNaN(seconds) && seconds > 0) {
                deleteAfter = seconds * 1000;
                messageArr.pop();
            }
        }

        const message = messageArr.join(' ');
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📢 Important Announcement')
                .setDescription(message)
                .setTimestamp()
                .setFooter({ 
                    text: `Sent from ${guild.name}${deleteAfter ? ` • Auto-deletes in ${deleteAfter/1000}s` : ''}`, 
                    iconURL: guild.iconURL({ dynamic: true }) 
                });

            // Fetch all members
            await guild.members.fetch();
            const members = guild.members.cache.filter(member => !member.user.bot);
            
            console.log(`\n📨 Starting broadcast to ${members.size} members in ${guild.name}...`);
            console.log(`Message will ${deleteAfter ? `be deleted after ${deleteAfter/1000} seconds` : 'not be deleted'}`);

            let sent = 0;
            let failed = 0;
            const sentMessages = new Map();
            const chunks = Array.from(members.values()).reduce((acc, member, i) => {
                const chunkIndex = Math.floor(i / 5);
                if (!acc[chunkIndex]) acc[chunkIndex] = [];
                acc[chunkIndex].push(member);
                return acc;
            }, []);

            for (const chunk of chunks) {
                // Process members in small chunks
                await Promise.all(chunk.map(async (member) => {
                    try {
                        const sentMessage = await member.send({ embeds: [embed] });
                        if (deleteAfter) {
                            sentMessages.set(member.id, sentMessage);
                        }
                        sent++;
                    } catch (error) {
                        failed++;
                        console.error(`Failed to DM ${member.user.tag}: ${error.message}`);
                    }
                }));

                // Show progress
                console.log(`Progress: ${sent + failed}/${members.size} (✅ ${sent} sent, ❌ ${failed} failed)`);
                
                // Add delay between chunks to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`\n📊 Broadcast Summary for ${guild.name}:
• Total Members: ${members.size}
• Successfully Sent: ${sent}
• Failed: ${failed}
• Success Rate: ${((sent / members.size) * 100).toFixed(1)}%`);

            // Handle message deletion if specified
            if (deleteAfter && sentMessages.size > 0) {
                setTimeout(async () => {
                    console.log('\n🗑️ Starting message deletion...');
                    let deleted = 0;
                    let deleteFailed = 0;

                    for (const [memberId, message] of sentMessages) {
                        try {
                            await message.delete();
                            deleted++;
                        } catch (error) {
                            deleteFailed++;
                        }
                        // Add delay between deletions
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    console.log(`\n🗑️ Deletion Complete:
• Total Messages: ${sentMessages.size}
• Successfully Deleted: ${deleted}
• Failed to Delete: ${deleteFailed}`);
                }, deleteAfter);
            }

        } catch (error) {
            console.error('Failed to execute broadcast:', error);
        }
    }

    async clearVoiceChannel([guildId, channelId, reason = 'Channel cleared via terminal']) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const channel = guild.channels.cache.get(channelId);

            if (!channel || channel.type !== 2) {
                console.log('❌ Invalid voice channel');
                return;
            }

            console.log(`Disconnecting ${channel.members.size} members from ${channel.name}...`);
            
            const disconnected = [];
            for (const [memberId, member] of channel.members) {
                try {
                    await member.voice.disconnect(reason);
                    disconnected.push(member.user.tag);
                } catch (error) {
                    console.error(`Failed to disconnect ${member.user.tag}:`, error.message);
                }
            }

            console.log(`✅ Disconnected ${disconnected.length} members`);
            
            // Log the action
            await this.client.logManager.logModAction(
                guild,
                'VOICE_CLEAR',
                {
                    target: channel.name,
                    moderator: this.client.user,
                    reason: reason,
                    additionalFields: [
                        { name: '👥 Affected Users', value: disconnected.join('\n') || 'None', inline: false }
                    ]
                }
            );
        } catch (error) {
            console.error('Failed to clear voice channel:', error);
        }
    }

    async changeNickname([guildId, userId, ...nicknameArr]) {
        const newNickname = nicknameArr.join(' ');
        
        if (!newNickname) {
            console.log('❌ Please provide a new nickname');
            return;
        }

        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            const oldNickname = member.nickname || member.user.username;

            // Check if bot has permission to manage nicknames
            if (!guild.members.me.permissions.has('ManageNicknames')) {
                console.log('❌ Bot lacks permission to manage nicknames');
                return;
            }

            // Check if target is manageable
            if (!member.manageable) {
                console.log('❌ Cannot manage this user\'s nickname (higher role hierarchy)');
                return;
            }

            // Change nickname
            await member.setNickname(newNickname, 'Changed via terminal');
            console.log(`✅ Changed nickname for ${member.user.tag}:`);
            console.log(`  Old: ${oldNickname}`);
            console.log(`  New: ${newNickname}`);

            // Log the action
            await this.client.logManager.logModAction(
                guild,
                'NICKNAME_CHANGE',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: 'Changed via terminal',
                    additionalFields: [
                        { name: '📝 Old Nickname', value: oldNickname, inline: true },
                        { name: '📝 New Nickname', value: newNickname, inline: true }
                    ]
                }
            );

        } catch (error) {
            console.error('Failed to change nickname:', error);
        }
    }

    async resetNickname([guildId, userId]) {
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            const oldNickname = member.nickname || member.user.username;

            // Check if bot has permission to manage nicknames
            if (!guild.members.me.permissions.has('ManageNicknames')) {
                console.log('❌ Bot lacks permission to manage nicknames');
                return;
            }

            // Check if target is manageable
            if (!member.manageable) {
                console.log('❌ Cannot manage this user\'s nickname (higher role hierarchy)');
                return;
            }

            // Reset nickname
            await member.setNickname(null, 'Reset via terminal');
            console.log(`✅ Reset nickname for ${member.user.tag}:`);
            console.log(`  Old: ${oldNickname}`);
            console.log(`  New: ${member.user.username}`);

            // Log the action
            await this.client.logManager.logModAction(
                guild,
                'NICKNAME_RESET',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: 'Reset via terminal',
                    additionalFields: [
                        { name: '📝 Old Nickname', value: oldNickname, inline: true },
                        { name: '📝 New Nickname', value: member.user.username, inline: true }
                    ]
                }
            );

        } catch (error) {
            console.error('Failed to reset nickname:', error);
        }
    }

    async serverMute([guildId, userId, ...reasonArr]) {
        const reason = reasonArr.join(' ') || 'Server muted via terminal';
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);

            if (!member.voice.channel) {
                console.log('❌ User is not in a voice channel');
                return;
            }

            if (member.voice.serverMute) {
                console.log('❌ User is already server muted');
                return;
            }

            await member.voice.setMute(true, reason);
            console.log(`✅ Server muted ${member.user.tag}`);

            // Log the action
            await this.client.logManager.logModAction(
                guild,
                'VOICE_SERVER_MUTE',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: reason,
                    additionalFields: [
                        { name: '🎤 Channel', value: member.voice.channel.name, inline: true }
                    ]
                }
            );
        } catch (error) {
            console.error('Failed to server mute user:', error);
        }
    }

    async serverUnmute([guildId, userId, ...reasonArr]) {
        const reason = reasonArr.join(' ') || 'Server unmuted via terminal';
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);

            if (!member.voice.channel) {
                console.log('❌ User is not in a voice channel');
                return;
            }

            if (!member.voice.serverMute) {
                console.log('❌ User is not server muted');
                return;
            }

            await member.voice.setMute(false, reason);
            console.log(`✅ Server unmuted ${member.user.tag}`);

            await this.client.logManager.logModAction(
                guild,
                'VOICE_SERVER_UNMUTE',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: reason,
                    additionalFields: [
                        { name: '🎤 Channel', value: member.voice.channel.name, inline: true }
                    ]
                }
            );
        } catch (error) {
            console.error('Failed to server unmute user:', error);
        }
    }

    async serverDeafen([guildId, userId, ...reasonArr]) {
        const reason = reasonArr.join(' ') || 'Server deafened via terminal';
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);

            if (!member.voice.channel) {
                console.log('❌ User is not in a voice channel');
                return;
            }

            if (member.voice.serverDeaf) {
                console.log('❌ User is already server deafened');
                return;
            }

            await member.voice.setDeaf(true, reason);
            console.log(`✅ Server deafened ${member.user.tag}`);

            await this.client.logManager.logModAction(
                guild,
                'VOICE_SERVER_DEAFEN',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: reason,
                    additionalFields: [
                        { name: '🔇 Channel', value: member.voice.channel.name, inline: true }
                    ]
                }
            );
        } catch (error) {
            console.error('Failed to server deafen user:', error);
        }
    }

    async serverUndeafen([guildId, userId, ...reasonArr]) {
        const reason = reasonArr.join(' ') || 'Server undeafened via terminal';
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);

            if (!member.voice.channel) {
                console.log('❌ User is not in a voice channel');
                return;
            }

            if (!member.voice.serverDeaf) {
                console.log('❌ User is not server deafened');
                return;
            }

            await member.voice.setDeaf(false, reason);
            console.log(`✅ Server undeafened ${member.user.tag}`);

            await this.client.logManager.logModAction(
                guild,
                'VOICE_SERVER_UNDEAFEN',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: reason,
                    additionalFields: [
                        { name: '🔊 Channel', value: member.voice.channel.name, inline: true }
                    ]
                }
            );
        } catch (error) {
            console.error('Failed to server undeafen user:', error);
        }
    }

    async moveVoice([guildId, userId, targetChannelId, ...reasonArr]) {
        const reason = reasonArr.join(' ') || 'Moved via terminal';
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            const targetChannel = guild.channels.cache.get(targetChannelId);

            // Validate member is in a voice channel
            if (!member.voice.channel) {
                console.log('❌ User is not in any voice channel');
                return;
            }

            // Validate target channel exists and is a voice channel
            if (!targetChannel || targetChannel.type !== 2) {
                console.log('❌ Invalid target voice channel');
                return;
            }

            // Check if user is already in the target channel
            if (member.voice.channelId === targetChannelId) {
                console.log('❌ User is already in that channel');
                return;
            }

            // Store original channel for logging
            const originalChannel = member.voice.channel;

            // Move the member
            await member.voice.setChannel(targetChannel, reason);
            console.log(`✅ Moved ${member.user.tag} from ${originalChannel.name} to ${targetChannel.name}`);

            // Log the action
            await this.client.logManager.logModAction(
                guild,
                'VOICE_MOVE',
                {
                    target: `${member.user.tag} (${member.user.id})`,
                    moderator: this.client.user,
                    reason: reason,
                    additionalFields: [
                        { name: '📤 From Channel', value: originalChannel.name, inline: true },
                        { name: '📥 To Channel', value: targetChannel.name, inline: true }
                    ]
                }
            );

        } catch (error) {
            console.error('Failed to move user:', error);
        }
    }
}

module.exports = ConsoleCommands;