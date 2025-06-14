const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');
const logManager = require('../../utils/LogManager');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testlogs')
        .setDescription('Test all log channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Get config
            const config = await guildConfig.loadGuildConfig(interaction.guildId);
            
            if (!config.logChannels) {
                return interaction.editReply({
                    content: '❌ No log channels configured. Please run `/logsetup setup` first.',
                    ephemeral: true
                });
            }
            
            const { roleLog, channelLog, messageLog, voiceLog } = config.logChannels;
            
            // Create results embed
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🧪 Log Channel Test Results')
                .setDescription('Testing all log channels...')
                .setTimestamp();
            
            // Test each log channel
            const results = [];
            
            // Test roleLog
            if (roleLog) {
                const channel = await interaction.guild.channels.fetch(roleLog).catch(() => null);
                if (channel && channel.permissionsFor(interaction.guild.members.me).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
                    await channel.send({ 
                        embeds: [new EmbedBuilder()
                            .setColor('#43b581')
                            .setTitle('✅ Role Log Test')
                            .setDescription('This is a test message for the role log system.')
                            .setTimestamp()]
                    }).then(() => {
                        results.push('✅ **Role Log:** Working properly');
                    }).catch(err => {
                        results.push(`❌ **Role Log:** Error - ${err.message}`);
                    });
                } else {
                    results.push('❌ **Role Log:** Channel not found or missing permissions');
                }
            } else {
                results.push('⚠️ **Role Log:** Not configured');
            }
            
            // Test channelLog
            if (channelLog) {
                const channel = await interaction.guild.channels.fetch(channelLog).catch(() => null);
                if (channel && channel.permissionsFor(interaction.guild.members.me).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
                    await channel.send({ 
                        embeds: [new EmbedBuilder()
                            .setColor('#43b581')
                            .setTitle('✅ Channel Log Test')
                            .setDescription('This is a test message for the channel log system.')
                            .setTimestamp()]
                    }).then(() => {
                        results.push('✅ **Channel Log:** Working properly');
                    }).catch(err => {
                        results.push(`❌ **Channel Log:** Error - ${err.message}`);
                    });
                } else {
                    results.push('❌ **Channel Log:** Channel not found or missing permissions');
                }
            } else {
                results.push('⚠️ **Channel Log:** Not configured');
            }
            
            // Test messageLog
            if (messageLog) {
                const channel = await interaction.guild.channels.fetch(messageLog).catch(() => null);
                if (channel && channel.permissionsFor(interaction.guild.members.me).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
                    await channel.send({ 
                        embeds: [new EmbedBuilder()
                            .setColor('#43b581')
                            .setTitle('✅ Message Log Test')
                            .setDescription('This is a test message for the message log system.')
                            .setTimestamp()]
                    }).then(() => {
                        results.push('✅ **Message Log:** Working properly');
                    }).catch(err => {
                        results.push(`❌ **Message Log:** Error - ${err.message}`);
                    });
                } else {
                    results.push('❌ **Message Log:** Channel not found or missing permissions');
                }
            } else {
                results.push('⚠️ **Message Log:** Not configured');
            }
            
            // Test voiceLog
            if (voiceLog) {
                const channel = await interaction.guild.channels.fetch(voiceLog).catch(() => null);
                if (channel && channel.permissionsFor(interaction.guild.members.me).has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
                    await channel.send({ 
                        embeds: [new EmbedBuilder()
                            .setColor('#43b581')
                            .setTitle('✅ Voice Log Test')
                            .setDescription('This is a test message for the voice log system.')
                            .setTimestamp()]
                    }).then(() => {
                        results.push('✅ **Voice Log:** Working properly');
                    }).catch(err => {
                        results.push(`❌ **Voice Log:** Error - ${err.message}`);
                    });
                } else {
                    results.push('❌ **Voice Log:** Channel not found or missing permissions');
                }
            } else {
                results.push('⚠️ **Voice Log:** Not configured');
            }
            
            // Clear cache to ensure logs will use fresh configs
            logManager.clearCache(interaction.guildId);
            
            // Update the embed with results
            embed.setDescription(results.join('\n\n'));
            
            // Send response
            await interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error testing logs:', error);
            await interaction.editReply({
                content: `❌ Error testing logs: ${error.message}`,
                ephemeral: true
            });
        }
    }
};