const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('The ID of the user to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unbanning')
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

            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Check if user is banned
            const banList = await interaction.guild.bans.fetch();
            const bannedUser = banList.find(ban => ban.user.id === userId);

            if (!bannedUser) {
                return await interaction.editReply({
                    content: '❌ This user is not banned.',
                    ephemeral: true
                });
            }

            // Unban user
            await interaction.guild.members.unban(userId, reason);

            // Create success embed
            const unbanEmbed = new EmbedBuilder()
                .setColor('#43b581')
                .setTitle('User Unbanned')
                .setDescription([
                    `**User:** ${bannedUser.user.tag} (${userId})`,
                    `**Reason:** ${reason}`,
                    `**Unbanned by:** ${interaction.user.tag}`
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [unbanEmbed] });

        } catch (error) {
            console.error('Unban command error:', error);
            await interaction.editReply({
                content: '❌ There was an error unbanning the user. Make sure the ID is valid.',
                ephemeral: true
            });
        }
    },
};