const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adduser')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add to the ticket')
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
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            // Check if user is already in the ticket
            const userPerms = interaction.channel.permissionOverwrites.cache.get(targetUser.id);
            if (userPerms?.allow.has('ViewChannel')) {
                return await interaction.editReply({
                    content: '❌ This user already has access to the ticket.',
                    ephemeral: true
                });
            }

            // Add user to the ticket channel with specific permissions
            await interaction.channel.permissionOverwrites.edit(targetUser, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            // Create success embed
            const addEmbed = new EmbedBuilder()
                .setColor(config.ticketSystem.settings.embedColors.main)
                .setTitle('User Added')
                .setDescription(`${targetUser} has been added to the ticket.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [addEmbed] });

            // Log the action
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(config.ticketSystem.channels.logs);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.ticketSystem.settings.embedColors.main)
                        .setTitle('User Added to Ticket')
                        .setDescription(`**Ticket:** ${interaction.channel.name}\n**User Added:** ${targetUser.tag} (${targetUser.id})\n**Added By:** ${interaction.user.tag}`)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ There was an error adding the user to the ticket.',
                ephemeral: true
            });
        }
    },
};