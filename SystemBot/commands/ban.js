const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for banning')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('delete_messages') // Changed from deleteMessages to delete_messages
                .setDescription('Delete the last 7 days of messages from the user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Check permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return await interaction.editReply({
                    content: '❌ You need Ban Members permission to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteMessages = interaction.options.getBoolean('delete_messages') || false; // Updated to match new option name
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Check if user is bannable
            if (!targetMember.bannable) {
                return await interaction.editReply({
                    content: '❌ I cannot ban this user due to role hierarchy.',
                    ephemeral: true
                });
            }

            // Perform the ban
            await interaction.guild.members.ban(targetUser, { 
                reason: reason,
                deleteMessageSeconds: deleteMessages ? 604800 : 0 // 7 days if true
            });

            // Create success embed
            const banEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('User Banned')
                .setDescription([
                    `**User:** ${targetUser.tag}`,
                    `**Reason:** ${reason}`,
                    `**Banned by:** ${interaction.user.tag}`,
                    deleteMessages ? '**Message History:** 7 days deleted' : ''
                ].filter(Boolean).join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [banEmbed] });

            // Log the moderation action
            await interaction.client.logManager.logModAction(
                interaction.guild,
                'BAN',
                {
                    target: `${targetUser.tag} (${targetUser.id})`,
                    moderator: interaction.user,
                    reason: reason,
                    additionalFields: deleteMessages ? [
                        { name: '🗑️ Message History', value: '7 days of messages deleted', inline: true }
                    ] : []
                }
            );

            // DM notification
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('You have been banned')
                    .setDescription([
                        `**Reason:** ${reason}`,
                        `**Banned by:** ${interaction.user.tag}`,
                        deleteMessages ? '**Message History:** 7 days of messages deleted' : ''
                    ].filter(Boolean).join('\n'))
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.warn(`Failed to send DM to ${targetUser.tag}:`, dmError);
            }

        } catch (error) {
            console.error('Ban command error:', error);
            await interaction.editReply({
                content: '❌ There was an error executing the ban command.',
                ephemeral: true
            });
        }
    },
};