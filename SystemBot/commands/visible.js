const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('visible')
        .setDescription('Make the current channel visible to regular users')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Check if command is used in a text channel
            if (interaction.channel.type !== ChannelType.GuildText) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in text channels.',
                    ephemeral: true
                });
            }

            // Get guild config and check permissions
            const config = await guildConfig.loadGuildConfig(interaction.guildId);
            const hasStaffRole = interaction.member.roles.cache.some(role => 
                config.ticketSystem.roles.staff.includes(role.id)
            );

            if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ You need staff role or administrator permissions to use this command.',
                    ephemeral: true
                });
            }

            // Check current permissions
            const currentPerms = interaction.channel.permissionOverwrites.cache.get(
                interaction.guild.roles.everyone.id
            );

            if (!currentPerms?.deny.has('ViewChannel')) {
                return await interaction.editReply({
                    content: '❌ This channel is already visible.',
                    ephemeral: true
                });
            }

            // Make the channel visible
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                ViewChannel: true,
                SendMessages: true,
                SendMessagesInThreads: true,
                CreatePublicThreads: true,
                CreatePrivateThreads: true
            });

            // Log action if configured
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(
                    config.ticketSystem.channels.logs
                );
                if (logChannel) {
                    await logChannel.send(
                        `🔓 Channel ${interaction.channel} was made visible by ${interaction.user}`
                    );
                }
            }

            await interaction.editReply({
                content: `Channel is now visible 👁️\nAll users can see and interact with it.`,
                ephemeral: true
            });

            // Send a visible message to the channel
            await interaction.channel.send({
                content: '🔓 This channel is now visible to all users.'
            });

        } catch (error) {
            console.error('Visible command error:', error);
            await interaction.editReply({
                content: 'There was an error making the channel visible.',
                ephemeral: true
            });
        }
    },
};