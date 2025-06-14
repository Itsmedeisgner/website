const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder 
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logsetup')
        .setDescription('Setup or reset logging channels for the server')
        .addSubcommand(subcommand => 
            subcommand
                .setName('setup')
                .setDescription('Configure log channels for different events')
                .addChannelOption(option =>
                    option.setName('rolelog')
                        .setDescription('Channel for role changes logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channellog')
                        .setDescription('Channel for channel changes logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('messagelog')
                        .setDescription('Channel for message logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('voicelog')
                        .setDescription('Channel for voice activity logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('modlog')
                        .setDescription('Channel for moderation logs')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset all log channel configurations'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const logManager = require('../../utils/LogManager');
        try {
            // Defer reply immediately
            await interaction.deferReply({ ephemeral: true });

            // Get the subcommand
            const subcommand = interaction.options.getSubcommand();
            

            if (subcommand === 'setup') {
                // Get channels from options
                const roleLog = interaction.options.getChannel('rolelog');
                const channelLog = interaction.options.getChannel('channellog');
                const messageLog = interaction.options.getChannel('messagelog');
                const voiceLog = interaction.options.getChannel('voicelog');
                const modLog = interaction.options.getChannel('modlog');

                // Check permissions for each channel
                for (const channel of [roleLog, channelLog, messageLog, voiceLog, modLog]) {
                    if (!channel.permissionsFor(interaction.guild.members.me).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
                        return await interaction.editReply({
                            content: `❌ I need View Channel, Send Messages, and Embed Links permissions in ${channel}`,
                            ephemeral: true
                        });
                    }
                }

                console.log('Log channels being set:', {
                    roleLog: roleLog.id,
                    channelLog: channelLog.id,
                    messageLog: messageLog.id,
                    voiceLog: voiceLog.id,
                    moderationLog: modLog.id
                });

                // Update guild config with log channels
                await guildConfig.updateGuildConfig(interaction.guildId, {
                    logChannels: {
                        roleLog: roleLog.id,
                        channelLog: channelLog.id,
                        messageLog: messageLog.id,
                        voiceLog: voiceLog.id,
                        moderationLog: modLog.id
                    }
                });

                // Clear the cache for this guild
                logManager.clearCache(interaction.guildId);
                console.log(`Cleared LogManager cache for guild: ${interaction.guildId}`);

                // Create test embed
                const testEmbed = new EmbedBuilder()
                    .setColor('#43b581')
                    .setTitle('✅ Log Channel Active')
                    .setDescription('This channel has been configured for logging.')
                    .setTimestamp();

                // Send test messages using Promise.allSettled to prevent failures
                const results = await Promise.allSettled([
                    roleLog.send({ embeds: [testEmbed] }),
                    channelLog.send({ embeds: [testEmbed] }),
                    messageLog.send({ embeds: [testEmbed] }),
                    voiceLog.send({ embeds: [testEmbed] }),
                    modLog.send({ embeds: [testEmbed] })
                ]);

                // Check for any failed sends
                const failedSends = results.filter(r => r.status === 'rejected');
                if (failedSends.length > 0) {
                    console.warn(`Failed to send test messages to ${failedSends.length} channels:`, 
                        failedSends.map(f => f.reason));
                }

                // Send success message
                const setupEmbed = new EmbedBuilder()
                    .setColor('#43b581')
                    .setTitle('📝 Logging System Setup')
                    .setDescription('Log channels have been configured successfully!')
                    .addFields([
                        { name: '📋 Role Logs', value: `${roleLog}`, inline: true },
                        { name: '🔧 Channel Logs', value: `${channelLog}`, inline: true },
                        { name: '💬 Message Logs', value: `${messageLog}`, inline: true },
                        { name: '🔊 Voice Logs', value: `${voiceLog}`, inline: true },
                        { name: '🛠️ Moderation Logs', value: `${modLog}`, inline: true }
                    ])
                    .setTimestamp();

                await interaction.editReply({ embeds: [setupEmbed] });
            } else if (subcommand === 'reset') {
                // Reset log channels in guild config
                await guildConfig.updateGuildConfig(interaction.guildId, {
                    logChannels: {
                        roleLog: null,
                        channelLog: null,
                        messageLog: null,
                        voiceLog: null,
                        moderationLog: null
                    }
                });

                // Clear the cache for this guild
                logManager.clearCache(interaction.guildId);
                console.log(`Reset log channels and cleared cache for guild: ${interaction.guildId}`);

                // Send success message
                const resetEmbed = new EmbedBuilder()
                    .setColor('#f04747')
                    .setTitle('🔄 Logging System Reset')
                    .setDescription('All log channel configurations have been reset.')
                    .setTimestamp();

                await interaction.editReply({ embeds: [resetEmbed] });
            }
        } catch (error) {
            console.error('Log setup error:', error);
            
            // Make sure we have a reply to edit
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ There was an error with the logging system configuration.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ There was an error with the logging system configuration.',
                    ephemeral: true
                });
            }
        }
    },
};