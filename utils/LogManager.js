const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const guildConfig = require('./guildConfig');

class LogManager {
    constructor() {
        this.client = null;
        this.debugMode = process.env.NODE_ENV === 'development';
        this.messageDebounce = new Map();
        this.cache = new Map();
        this.initialized = false;
        this.boundHandlers = new Map();
    }

    // Add this method to clear cache
    clearCache(guildId) {
        if (guildId) {
            // Clear cache for specific guild
            this.cache.delete(guildId);
            console.log(`Cleared cache for guild: ${guildId}`);
        } else {
            // Clear entire cache
            this.cache.clear();
            console.log('Cleared entire LogManager cache');
        }
    }

    /**
     * Initialize the LogManager with the client reference
     * @param {Client} discordClient - The Discord.js client
     */
    init(discordClient) {
        this.client = discordClient;
        this.initialized = true;
        this.setupEventListeners();
        console.log('LogManager initialized with client reference');
    }

    /**
     * Remove all existing event listeners
     */
    removeEventListeners() {
        if (!this.client) return;
        
        // Remove all existing event listeners
        for (const [event, handler] of this.boundHandlers) {
            this.client.removeListener(event, handler);
        }
        this.boundHandlers.clear();
    }

    /**
     * Setup all event listeners for logging
     */
    setupEventListeners() {
        if (!this.client) {
            console.error('Cannot setup event listeners: No client reference');
            return;
        }

        // Remove existing listeners first
        this.removeEventListeners();

        // Define handlers inline
        const handlers = {
            messageCreate: async (message) => {
                if (message.author.bot) return;
                await this.logMessage(message.guild, message, 'create');
            },
            messageUpdate: async (oldMessage, newMessage) => {
                if (newMessage.author?.bot) return;
                await this.logMessage(newMessage.guild, newMessage, 'edit', oldMessage);
            },
            messageDelete: async (message) => {
                if (message.author?.bot) return;
                await this.logMessage(message.guild, message, 'delete');
            },
            channelCreate: async (channel) => {
                if (!channel.guild) return;
                const auditLog = await channel.guild.fetchAuditLogs({
                    type: AuditLogEvent.ChannelCreate,
                    limit: 1
                }).catch(() => null);
                const executor = auditLog?.entries.first()?.executor;
                await this.logChannel(channel.guild, executor, channel, 'create');
            },
            channelDelete: async (channel) => {
                if (!channel.guild) return;
                const auditLog = await channel.guild.fetchAuditLogs({
                    type: AuditLogEvent.ChannelDelete,
                    limit: 1
                }).catch(() => null);
                const executor = auditLog?.entries.first()?.executor;
                await this.logChannel(channel.guild, executor, channel, 'delete');
            },
            channelUpdate: async (oldChannel, newChannel) => {
                if (!newChannel.guild) return;
                const auditLog = await newChannel.guild.fetchAuditLogs({
                    type: AuditLogEvent.ChannelUpdate,
                    limit: 1
                }).catch(() => null);
                const executor = auditLog?.entries.first()?.executor;
                await this.logChannel(newChannel.guild, executor, newChannel, 'update', oldChannel);
            },
            guildMemberUpdate: async (oldMember, newMember) => {
                try {
                    // Check for role changes
                    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
                    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

                    const auditLog = await newMember.guild.fetchAuditLogs({
                        type: AuditLogEvent.MemberRoleUpdate,
                        limit: 1
                    }).catch(() => null);
                    const executor = auditLog?.entries.first()?.executor;

                    // Log added roles
                    for (const [id, role] of addedRoles) {
                        await this.logRole(newMember.guild, executor, newMember.user, role, 'add');
                    }

                    // Log removed roles
                    for (const [id, role] of removedRoles) {
                        await this.logRole(newMember.guild, executor, newMember.user, role, 'remove');
                    }
                } catch (error) {
                    console.error('Error handling role update:', error);
                }
            },
            voiceStateUpdate: async (oldState, newState) => {
                await this.logVoice(oldState, newState);
            }
        };

        // Register all handlers
        for (const [event, handler] of Object.entries(handlers)) {
            this.client.on(event, handler);
            this.boundHandlers.set(event, handler);
        }
        console.log('Event listeners set up successfully');
    }

    async getLogChannels(guildId) {
        try {
            const config = await guildConfig.loadGuildConfig(guildId);
            if (this.debugMode) {
                console.log('Fetched log channels:', config.logChannels);
            }
            return {
                roleLog: config.logChannels?.roleLog,
                channelLog: config.logChannels?.channelLog,
                messageLog: config.logChannels?.messageLog,
                voiceLog: config.logChannels?.voiceLog
            };
        } catch (error) {
            console.error('Error fetching log channels:', error);
            return {};
        }
    }

    logDebug(message, data = {}) {
        if (this.debugMode) {
            console.log(`[LogManager] ${message}`, data);
        }
    }    async checkLogChannel(guild, channelId, type) {
        if (!channelId) {
            this.logDebug(`No ${type} log channel configured for guild:`, guild.id);
            console.error(`No ${type} log channel configured for guild ${guild.name} (${guild.id}). Please use /logsetup to configure logging.`);
            return null;
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            this.logDebug(`Could not find ${type} log channel:`, channelId);
            return null;
        }

        if (!channel.permissionsFor(guild.members.me).has('SendMessages')) {
            this.logDebug(`Missing SendMessages permission in ${type} log channel:`, channel.name);
            return null;
        }

        return channel;
    }    async logRole(guild, executor, target, role, action) {
        try {
            const channels = await this.getLogChannels(guild.id);
            const logChannel = await this.checkLogChannel(guild, channels.roleLog, 'role');
            if (!logChannel) return;

            // Add null checks for role
            if (!role && action !== 'update') {
                console.warn('No role provided for logging');
                return;
            }

            let color, title, description;
            switch (action) {
                case 'add':
                    color = '#43b581'; // Green
                    title = '➕ Role Added';
                    description = [
                        `**Role:** ${role ? `${role} (${role.id})` : 'Unknown Role'}`,
                        `**Member:** ${target ? `${target} (${target.id})` : 'Unknown Member'}`,
                        `**Action By:** ${executor ? `${executor} (${executor.id})` : 'System'}`,
                        role ? `**Role Color:** ${role.hexColor}` : '',
                        role ? `**Role Position:** ${role.position}` : '',
                        role ? `**Role Permissions:** ${this.formatPermissions(role.permissions)}` : ''
                    ].filter(Boolean).join('\n');
                    break;

                case 'remove':
                    color = '#f04747'; // Red
                    title = '➖ Role Removed';
                    description = [
                        `**Role:** ${role ? `${role} (${role.id})` : 'Unknown Role'}`,
                        `**Member:** ${target ? `${target} (${target.id})` : 'Unknown Member'}`,
                        `**Action By:** ${executor ? `${executor} (${executor.id})` : 'System'}`
                    ].filter(Boolean).join('\n');
                    break;

                case 'create':
                    color = '#3498db'; // Blue
                    title = '🆕 Role Created';
                    if (!role) return; // Skip if no role data
                    description = [
                        `**Role:** ${role} (${role.id})`,
                        `**Created By:** ${executor ? `${executor} (${executor.id})` : 'System'}`,
                        `**Color:** ${role.hexColor}`,
                        `**Hoisted:** ${role.hoist ? 'Yes' : 'No'}`,
                        `**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}`,
                        `**Position:** ${role.position}`,
                        `**Permissions:** ${this.formatPermissions(role.permissions)}`
                    ].join('\n');
                    break;

                case 'delete':
                    color = '#e74c3c'; // Dark Red
                    title = '🗑️ Role Deleted';
                    if (!role) return; // Skip if no role data
                    description = [
                        `**Role Name:** ${role.name}`,
                        `**Role ID:** ${role.id}`,
                        `**Deleted By:** ${executor ? `${executor} (${executor.id})` : 'System'}`,
                        `**Color:** ${role.hexColor}`,
                        `**Members Affected:** ${role.members?.size || 0}`
                    ].join('\n');
                    break;

                case 'update':
                    color = '#f1c40f'; // Yellow
                    title = '✏️ Role Updated';
                    const changes = role && role._oldData ? 
                        this.getRoleChanges(role._oldData, role) : 
                        ['Role data updated'];
                    description = [
                        `**Role:** ${role ? `${role} (${role.id})` : 'Unknown Role'}`,
                        `**Updated By:** ${executor ? `${executor} (${executor.id})` : 'System'}`,
                        '',
                        '**Changes:**',
                        changes.length ? changes.join('\n') : 'No detectable changes'
                    ].filter(Boolean).join('\n');
                    break;
            }

            // Create and send embed only if we have valid data
            if (title && description) {
                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(title)
                    .setDescription(description)
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in logRole:', error);
        }
    }    async logChannel(guild, executor, channel, action, oldData = null) {
        try {
            const channels = await this.getLogChannels(guild.id);
            const logChannel = await this.checkLogChannel(guild, channels.channelLog, 'channel');
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor(this.getActionColor(action))
                .setAuthor({ 
                    name: `Channel ${this.formatAction(action)}`, 
                    iconURL: executor.displayAvatarURL() 
                })
                .setTimestamp();

            switch (action) {
                case 'create':
                    embed.setDescription([
                        `📝 **New Channel Created**`,
                        `Channel: ${channel}`,
                        `Name: \`${channel.name}\``,
                        `Type: \`${this.formatChannelType(channel.type)}\``,
                        `Category: \`${channel.parent?.name || 'None'}\``,
                        `Created by: ${executor}`
                    ].join('\n'));
                    break;

                case 'delete':
                    embed.setDescription([
                        `🗑️ **Channel Deleted**`,
                        `Name: \`${channel.name}\``,
                        `Type: \`${this.formatChannelType(channel.type)}\``,
                        `Category: \`${channel.parent?.name || 'None'}\``,
                        `Deleted by: ${executor}`
                    ].join('\n'));
                    break;

                case 'update':
                    const changes = this.getChannelChanges(oldData, channel);
                    if (changes.length === 0) return;

                    embed.setDescription([
                        `✏️ **Channel Updated**`,
                        `Channel: ${channel}`,
                        '',
                        '**Changes:**',
                        ...changes,
                        '',
                        `Updated by: ${executor}`
                    ].join('\n'));
                    break;
            }

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error in logChannel:', error);
        }
    }

    async logMessage(guild, message, action, oldMessage = null, executor = null) {
        try {
            if (this.debugMode) {
                console.log(`Attempting to log message ${action}:`, {
                    guild: guild.id,
                    channel: message.channel.id,
                    messageId: message.id
                });
            }

            const channels = await this.getLogChannels(guild.id);
            if (!channels.messageLog) {
                if (this.debugMode) console.log('No message log channel configured');
                return;
            }

            const logChannel = guild.channels.cache.get(channels.messageLog);
            if (!logChannel) {
                if (this.debugMode) console.log('Could not find log channel:', channels.messageLog);
                return;
            }

            // Check permissions
            if (!logChannel.permissionsFor(guild.members.me).has('SendMessages')) {
                console.error(`Missing SendMessages permission in log channel: ${logChannel.name}`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(this.getActionColor(action))
                .setAuthor({ 
                    name: `Message ${this.formatAction(action)}`, 
                    iconURL: message.author.displayAvatarURL() 
                })
                .setTimestamp();

            switch (action) {
                case 'create':
                    embed.setDescription([
                        `📝 **New Message Sent**`,                        `Channel: ${message.channel}`,
                        `Author: ${message.author}`,
                        '',
                        '**Content:**',
                        message.content?.trim() ? message.content : '*No content*'
                    ].join('\n'));
                    break;

                case 'edit':
                    if (!oldMessage) return;
                    embed.setDescription([
                        `✏️ **Message Edited**`,
                        `Channel: ${message.channel}`,
                        `Author: ${message.author}`,
                        '',
                        '**Before:**',
                        oldMessage.content || '*No content*',
                        '',
                        '**After:**',
                        message.content || '*No content*'
                    ].join('\n'));
                    break;

                case 'delete':
                    embed.setDescription([
                        `🗑️ **Message Deleted**`,
                        `Channel: ${message.channel}`,
                        `Author: ${message.author}`,
                        executor ? `Deleted by: ${executor}` : '*No audit log entry found*',
                        '',
                        '**Content:**',
                        message.content || '*No content*'
                    ].join('\n'));
                    break;
            }

            // Add attachments if any
            if (message.attachments.size > 0) {
                const attachmentsList = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n');
                embed.addFields({ 
                    name: '📎 Attachments', 
                    value: attachmentsList 
                });
            }

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Error logging message ${action}:`, error);
        }
    }

    async logVoice(oldState, newState, executor = null) {
        try {
            const channels = await this.getLogChannels(newState.guild.id);
            if (!channels.voiceLog) {
                if (this.debugMode) console.log('No voice log channel configured');
                return;
            }

            const logChannel = newState.guild.channels.cache.get(channels.voiceLog);
            if (!logChannel) {
                if (this.debugMode) console.log('Could not find voice log channel:', channels.voiceLog);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(this.getVoiceActionColor(oldState, newState))
                .setAuthor({ 
                    name: 'Voice Activity', 
                    iconURL: newState.member.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Get action description
            const description = this.getVoiceActionDescription(oldState, newState, executor);
            if (!description) return;

            embed.setDescription(description);
            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error in logVoice:', error);
        }
    }

    formatChannelType(type) {
        const types = {
            GUILD_TEXT: 'Text Channel',
            GUILD_VOICE: 'Voice Channel',
            GUILD_CATEGORY: 'Category',
            GUILD_NEWS: 'Announcement Channel',
            GUILD_STAGE_VOICE: 'Stage Channel',
            GUILD_FORUM: 'Forum Channel'
        };
        return types[type] || type;
    }

    getChannelChanges(oldData, newData) {
        const changes = [];
        
        if (oldData.name !== newData.name) {
            changes.push(`📋 Name: \`${oldData.name}\` → \`${newData.name}\``);
        }
        
        if (oldData.topic !== newData.topic) {
            changes.push(`📌 Topic: \`${oldData.topic || 'None'}\` → \`${newData.topic || 'None'}\``);
        }

        if (oldData.parent?.id !== newData.parent?.id) {
            changes.push(`📁 Category: \`${oldData.parent?.name || 'None'}\` → \`${newData.parent?.name || 'None'}\``);
        }

        if (oldData.nsfw !== newData.nsfw) {
            changes.push(`🔞 NSFW: \`${oldData.nsfw}\` → \`${newData.nsfw}\``);
        }

        return changes;
    }

    getActionColor(action) {
        const colors = {
            create: '#43b581',  // Green
            delete: '#f04747',  // Red
            update: '#faa61a'   // Orange
        };
        return colors[action] || '#7289da';
    }

    formatAction(action) {
        return action.charAt(0).toUpperCase() + action.slice(1) + 'd';
    }

    getVoiceActionColor(oldState, newState) {
        if (!oldState.channelId && newState.channelId) return '#43b581'; // Join
        if (oldState.channelId && !newState.channelId) return '#f04747'; // Leave
        if (oldState.channelId !== newState.channelId) return '#faa61a'; // Move
        return '#7289da'; // Other changes
    }    getVoiceActionDescription(oldState, newState, executor) {
        const member = newState.member;
        
        // Join voice channel
        if (!oldState.channelId && newState.channelId) {
            return [
                `👋 **Member Joined Voice**`,
                `**Member:** ${member}`,
                `**Channel:** ${newState.channel}`
            ].join('\n');
        }
        
        // Leave voice channel
        if (oldState.channelId && !newState.channelId) {
            return [
                `🚶 **Member Left Voice**`,
                `**Member:** ${member}`,
                `**Channel:** ${oldState.channel}`
            ].join('\n');
        }
        
        // Switch channels
        if (oldState.channelId !== newState.channelId) {
            const description = [
                `↔️ **Member ${executor ? 'Moved' : 'Switched'}**`,
                `**Member:** ${member}`,
                `**From:** ${oldState.channel}`,
                `**To:** ${newState.channel}`
            ];
            
            if (executor) {
                description.push(`**Moved by:** ${executor}`);
            }
            
            return description.join('\n');
        }

        // Voice state changes
        const changes = [];
        
        if (oldState.serverMute !== newState.serverMute) {
            changes.push(`**Server Mute:** ${newState.serverMute ? '🔇 Enabled' : '🔊 Disabled'}`);
        }
        
        if (oldState.serverDeaf !== newState.serverDeaf) {
            changes.push(`**Server Deafen:** ${newState.serverDeaf ? '🔇 Enabled' : '🔊 Disabled'}`);
        }
        
        if (oldState.selfMute !== newState.selfMute) {
            changes.push(`**Self Mute:** ${newState.selfMute ? '🔇 Enabled' : '🔊 Disabled'}`);
        }
        
        if (oldState.selfDeaf !== newState.selfDeaf) {
            changes.push(`**Self Deafen:** ${newState.selfDeaf ? '🔇 Enabled' : '🔊 Disabled'}`);
        }

        if (changes.length > 0) {
            return [
                `⚙️ **Voice State Updated**`,
                `**Member:** ${member}`,
                `**Channel:** ${newState.channel}`,
                '',
                ...changes
            ].join('\n');
        }

        return null;
    }

    async logModAction(guild, action, data) {
        try {
            const channels = await this.getLogChannels(guild.id);
            const logChannel = guild.channels.cache.get(channels.moderationLog || channels.channelLog);

            if (!logChannel) {
                console.warn(`No moderation log channel configured for guild ${guild.name} (${guild.id})`);
                return;
            }

            if (!logChannel.permissionsFor(guild.members.me).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
                console.error(`Missing permissions in moderation log channel: ${logChannel.name}`);
                return;
            }

            const colors = {
                BAN: '#FF0000',      // Red
                UNBAN: '#00FF00',    // Green
                KICK: '#FFA500',     // Orange
                TIMEOUT: '#FFD700',   // Gold
                UNTIMEOUT: '#32CD32', // Lime Green
                MUTE: '#A52A2A',     // Brown
                UNMUTE: '#98FB98'     // Pale Green
            };

            const emojis = {
                BAN: '🔨',
                UNBAN: '🔓',
                KICK: '👢',
                TIMEOUT: '⏰',
                UNTIMEOUT: '✅',
                MUTE: '🔇',
                UNMUTE: '🔊'
            };

            const embed = new EmbedBuilder()
                .setColor(colors[action] || '#7289DA')
                .setTitle(`${emojis[action]} ${action.charAt(0) + action.slice(1).toLowerCase()}`)
                .addFields(
                    { name: '👤 User', value: `${data.target}`, inline: true },
                    { name: '🛠️ Moderator', value: `${data.moderator}`, inline: true }
                )
                .setTimestamp();

            // Add reason field if provided
            if (data.reason) {
                embed.addFields({ name: '📄 Reason', value: data.reason, inline: false });
            }

            // Add duration field for timeout/mute
            if (data.duration) {
                embed.addFields({ name: '⏳ Duration', value: data.duration, inline: false });
            }

            // Add additional fields if provided
            if (data.additionalFields) {
                data.additionalFields.forEach(field => {
                    embed.addFields(field);
                });
            }

            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error(`Error logging moderation action ${action}:`, error);
        }
    }

    // Add this helper method to format permissions
    formatPermissions(permissions) {
        const keyPerms = [
            'Administrator',
            'ManageRoles',
            'ManageChannels',
            'KickMembers',
            'BanMembers',
            'ManageGuild',
            'ManageMessages',
            'MentionEveryone'
        ];

        const permArray = permissions.toArray();
        const important = permArray.filter(p => keyPerms.includes(p));
        
        if (important.length === 0) return 'No key permissions';
        if (important.includes('Administrator')) return '**Administrator**';
        return important.map(p => `\`${p}\``).join(', ');
    }

    // Add this helper method to detect role changes
    getRoleChanges(oldRole, newRole) {
        const changes = [];

        if (oldRole.name !== newRole.name) {
            changes.push(`• Name: \`${oldRole.name}\` → \`${newRole.name}\``);
        }
        if (oldRole.color !== newRole.color) {
            changes.push(`• Color: \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
        }
        if (oldRole.hoist !== newRole.hoist) {
            changes.push(`• Hoisted: \`${oldRole.hoist}\` → \`${newRole.hoist}\``);
        }
        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(`• Mentionable: \`${oldRole.mentionable}\` → \`${newRole.mentionable}\``);
        }
        if (oldRole.position !== newRole.position) {
            changes.push(`• Position: \`${oldRole.position}\` → \`${newRole.position}\``);
        }
        if (!oldRole.permissions.equals(newRole.permissions)) {
            changes.push(`• Permissions Updated`);
        }

        return changes;
    }
}

module.exports = new LogManager();