const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            // Add defer reply at the start
            await interaction.deferReply();

            // Check if command is used in a text channel
            if (interaction.channel.type !== ChannelType.GuildText) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in text channels.',
                    ephemeral: true
                });
            }

            // Get the guild configuration
            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            // Check if user has staff role or is administrator
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

            if (currentPerms?.allow.has('SendMessages')) {
                return await interaction.editReply({
                    content: '❌ This channel is already unlocked.',
                    ephemeral: true
                });
            }

            // Unlock the channel
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null,
                SendMessagesInThreads: null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
            });

            // Send success message
            await interaction.editReply({
                content: 'The Channel Has Been Unlocked 🔓'
            });

            // Log action if configured
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(
                    config.ticketSystem.channels.logs
                );
                if (logChannel) {
                    await logChannel.send(
                        `🔓 Channel ${interaction.channel} was unlocked by ${interaction.user}`
                    );
                }
            }

        } catch (error) {
            console.error('Unlock command error:', error);
            if (interaction.deferred) {
                await interaction.editReply({
                    content: 'There was an error unlocking the channel.',
                    ephemeral: true
                }).catch(console.error);
            } else {
                await interaction.reply({
                    content: 'There was an error unlocking the channel.',
                    ephemeral: true
                }).catch(console.error);
            }
        }
    },
};