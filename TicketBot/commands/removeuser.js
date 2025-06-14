const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeuser')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove from the ticket')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Load guild config
            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            // Check if command is used in a ticket channel
            if (!interaction.channel.name.startsWith('ticket-')) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }

            // Check if user has staff role
            const hasStaffRole = interaction.member.roles.cache.some(role => 
                config.ticketSystem.roles.staff.includes(role.id)
            );

            if (!hasStaffRole) {
                return await interaction.editReply({
                    content: '❌ You don\'t have permission to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            
            // Get ticket owner from channel name
            const ticketOwner = interaction.channel.name.split('-')[1];
            
            // Prevent removing ticket owner
            if (targetUser.username.toLowerCase() === ticketOwner.toLowerCase()) {
                return await interaction.editReply({
                    content: '❌ You cannot remove the ticket owner.',
                    ephemeral: true
                });
            }

            // Check if user has access to the ticket
            const userPerms = interaction.channel.permissionOverwrites.cache.get(targetUser.id);
            if (!userPerms?.allow.has('ViewChannel')) {
                return await interaction.editReply({
                    content: '❌ This user is not in the ticket.',
                    ephemeral: true
                });
            }

            // Remove user's permissions from the channel
            await interaction.channel.permissionOverwrites.delete(targetUser);

            // Create success embed
            const removeEmbed = new EmbedBuilder()
                .setColor(config.ticketSystem.settings.embedColors.main)
                .setTitle('User Removed')
                .setDescription(`${targetUser} has been removed from the ticket.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [removeEmbed] });

            // Log the action
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(config.ticketSystem.channels.logs);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.ticketSystem.settings.embedColors.main)
                        .setTitle('User Removed from Ticket')
                        .setDescription(`**Ticket:** ${interaction.channel.name}\n**User Removed:** ${targetUser.tag} (${targetUser.id})\n**Removed By:** ${interaction.user.tag}`)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ There was an error removing the user from the ticket.',
                ephemeral: true
            });
        }
    },
};