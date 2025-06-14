const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove timeout from a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove timeout from')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for removing timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Check permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.editReply({
                    content: '❌ You need Moderate Members permission to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Check if user is currently timed out
            if (!targetMember.isCommunicationDisabled()) {
                return await interaction.editReply({
                    content: '❌ This user is not timed out.',
                    ephemeral: true
                });
            }

            // Check if bot can moderate the user
            if (!targetMember.moderatable) {
                return await interaction.editReply({
                    content: '❌ I cannot remove timeout from this user due to role hierarchy.',
                    ephemeral: true
                });
            }

            // Remove timeout
            await targetMember.timeout(null, reason);

            // Create success embed
            const untimeoutEmbed = new EmbedBuilder()
                .setColor('#43b581')
                .setTitle('Timeout Removed')
                .setDescription([
                    `**User:** ${targetUser.tag}`,
                    `**Reason:** ${reason}`,
                    `**Removed by:** ${interaction.user.tag}`
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [untimeoutEmbed] });

            // Try to DM the user
            try {
                await targetUser.send({
                    content: `Your timeout in ${interaction.guild.name} has been removed.\nReason: ${reason}`
                });
            } catch (error) {
                console.log('Could not DM user about timeout removal');
            }

        } catch (error) {
            console.error('Untimeout command error:', error);
            await interaction.editReply({
                content: '❌ There was an error removing the timeout.',
                ephemeral: true
            });
        }
    },
};