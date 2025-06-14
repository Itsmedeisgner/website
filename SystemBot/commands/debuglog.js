const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require('discord.js');
const logManager = require('../../utils/LogManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debuglog')
        .setDescription('Test a specific log type')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of log to test')
                .setRequired(true)
                .addChoices(
                    { name: 'Message', value: 'message' },
                    { name: 'Role', value: 'role' },
                    { name: 'Channel', value: 'channel' },
                    { name: 'Voice', value: 'voice' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const type = interaction.options.getString('type');

            // Force debug mode
            logManager.debugMode = true;

            switch (type) {
                case 'message':
                    // Test message logging
                    await interaction.channel.send('Test message for logging')
                        .then(msg => msg.delete());
                    break;

                case 'role':
                    // Test role logging
                    const role = await interaction.guild.roles.create({
                        name: 'TestLogRole',
                        color: '#ff0000',
                        reason: 'Testing role logs'
                    });
                    
                    // Wait a moment then add the role to trigger the event
                    await new Promise(r => setTimeout(r, 1000));
                    await interaction.member.roles.add(role, 'Testing role add');
                    
                    // Wait again then remove the role
                    await new Promise(r => setTimeout(r, 1000));
                    await interaction.member.roles.remove(role, 'Testing role remove');
                    
                    // Finally delete the test role
                    await new Promise(r => setTimeout(r, 1000));
                    await role.delete('Testing role logs');
                    break;

                case 'channel':
                    // Test channel logging
                    const category = await interaction.guild.channels.create({
                        name: 'Test Category',
                        type: ChannelType.GuildCategory,
                        reason: 'Testing channel logs'
                    });
                    
                    // Create a channel in the category
                    const testChannel = await interaction.guild.channels.create({
                        name: 'test-log-channel',
                        type: ChannelType.GuildText,
                        parent: category.id,
                        reason: 'Testing channel logs'
                    });
                    
                    // Wait then modify the channel
                    await new Promise(r => setTimeout(r, 1000));
                    await testChannel.setName('test-log-channel-edited', 'Testing channel update');
                    
                    // Wait then delete everything
                    await new Promise(r => setTimeout(r, 1000));
                    await testChannel.delete('Testing channel logs');
                    await category.delete('Testing channel logs');
                    break;

                case 'voice':
                    // Test voice logging by simulating events
                    const voiceChannels = interaction.guild.channels.cache
                        .filter(c => c.type === 2);
                    
                    if (voiceChannels.size > 0) {
                        const testChannel = voiceChannels.first();
                        await logManager.handleVoiceStateUpdate(
                            { channelId: null, guild: interaction.guild },
                            { 
                                channelId: testChannel.id,
                                guild: interaction.guild,
                                member: interaction.member,
                                channel: testChannel
                            }
                        );
                    }
                    break;
            }

            await interaction.editReply({
                content: `✅ Triggered test for ${type} logs. Check your log channels.`,
                ephemeral: true
            });

        } catch (error) {
            console.error(`Error testing ${type} logs:`, error);
            await interaction.editReply({
                content: `❌ Error testing logs: ${error.message}`,
                ephemeral: true
            });
        } finally {
            logManager.debugMode = false;
        }
    }
};