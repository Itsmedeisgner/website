const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for kicking')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Check permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
                return await interaction.editReply({
                    content: '❌ You need Kick Members permission to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Additional checks
            if (targetUser.id === interaction.guild.ownerId) {
                return await interaction.editReply({
                    content: '❌ Cannot kick the server owner.',
                    ephemeral: true
                });
            }

            if (targetUser.id === interaction.client.user.id) {
                return await interaction.editReply({
                    content: '❌ Cannot kick myself.',
                    ephemeral: true
                });
            }

            if (!targetMember.kickable) {
                return await interaction.editReply({
                    content: '❌ I cannot kick this user due to role hierarchy.',
                    ephemeral: true
                });
            }

            // Perform the kick
            await targetMember.kick(reason);

            // Create success embed
            const kickEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('User Kicked')
                .setDescription([
                    `**User:** ${targetUser.tag}`,
                    `**Reason:** ${reason}`,
                    `**Kicked by:** ${interaction.user.tag}`
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [kickEmbed] });

            // Log the moderation action
            await interaction.client.logManager.logModAction(
                interaction.guild,
                'KICK',
                {
                    target: `${targetUser.tag} (${targetUser.id})`,
                    moderator: interaction.user,
                    reason: reason
                }
            );

            // Try to DM the user
            try {
                await targetUser.send({
                    content: `You have been kicked from ${interaction.guild.name}\nReason: ${reason}`
                });
            } catch (error) {
                console.log('Could not DM kicked user');
            }

        } catch (error) {
            console.error('Kick command error:', error);
            await interaction.editReply({
                content: '❌ There was an error executing the kick command.',
                ephemeral: true
            });
        }
    },
};