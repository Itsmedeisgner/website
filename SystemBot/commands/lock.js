const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');
const errorHandler = require('../../TicketBot/utils/errorHandler'); // Add this line

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            // Add this line at the start
            await interaction.deferReply();

            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            const hasStaffRole = interaction.member.roles.cache.some(role => 
                config.ticketSystem.roles.staff.includes(role.id)
            );

            // Check channel type
            if (interaction.channel.type !== ChannelType.GuildText) {
                return await interaction.reply({
                    content: '❌ This command can only be used in text channels.',
                    ephemeral: true
                });
            }

            // Lock channel
            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone, 
                {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false
                }
            );

            // Send response
            await interaction.editReply({
                content: 'The Channel Has Been Locked 🔒'
            });

            // Log action if configured
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(
                    config.ticketSystem.channels.logs
                );
                if (logChannel) {
                    await logChannel.send(
                        `🔒 Channel ${interaction.channel} was locked by ${interaction.user}`
                    );
                }
            }

        } catch (error) {
            console.error('Lock command error:', error);
            // Use errorHandler properly
            if (interaction.deferred) {
                await interaction.editReply({
                    content: 'There was an error locking the channel.',
                    ephemeral: true
                }).catch(console.error);
            } else {
                await interaction.reply({
                    content: 'There was an error locking the channel.',
                    ephemeral: true
                }).catch(console.error);
            }
        }
    },
};