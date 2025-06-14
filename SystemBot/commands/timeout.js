const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user for a specified duration')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration (e.g. 5m, 2h, 3d, 1w)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for timeout')
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
            const duration = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Check if user is moderatable
            if (!targetMember.moderatable) {
                return await interaction.editReply({
                    content: '❌ I cannot timeout this user due to role hierarchy.',
                    ephemeral: true
                });
            }

            // Parse duration
            const ms = parseDuration(duration);
            if (!ms) {
                return await interaction.editReply({
                    content: '❌ Invalid duration format. Use: s (seconds), m (minutes), h (hours), d (days), w (weeks)',
                    ephemeral: true
                });
            }

            // Check maximum timeout duration (28 days)
            const maxTimeout = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
            if (ms > maxTimeout) {
                return await interaction.editReply({
                    content: '❌ Timeout duration cannot exceed 28 days.',
                    ephemeral: true
                });
            }

            // Apply timeout
            await targetMember.timeout(ms, reason);
            const formattedDuration = formatDuration(ms);

            // Create success embed
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('User Timed Out')
                .setDescription([
                    `**User:** ${targetUser.tag}`,
                    `**Duration:** ${formattedDuration}`,
                    `**Reason:** ${reason}`,
                    `**Timed out by:** ${interaction.user.tag}`
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [timeoutEmbed] });

            // Log the moderation action
            await interaction.client.logManager.logModAction(
                interaction.guild,
                'TIMEOUT',
                {
                    target: `${targetUser.tag} (${targetUser.id})`,
                    moderator: interaction.user,
                    reason: reason,
                    duration: formattedDuration
                }
            );

            // Try to DM the user
            try {
                await targetUser.send({
                    content: `You have been timed out in ${interaction.guild.name} for ${formattedDuration}\nReason: ${reason}`
                });
            } catch (error) {
                console.log('Could not DM user about timeout');
            }

        } catch (error) {
            console.error('Timeout command error:', error);
            await interaction.editReply({
                content: '❌ There was an error executing the timeout command.',
                ephemeral: true
            });
        }
    },
};

function parseDuration(duration) {
    const match = duration.match(/^(\d+)(s|m|h|d|w|mo)$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        s: 1000,                    // seconds
        m: 60 * 1000,              // minutes
        h: 60 * 60 * 1000,         // hours
        d: 24 * 60 * 60 * 1000,    // days
        w: 7 * 24 * 60 * 60 * 1000, // weeks
        mo: 30 * 24 * 60 * 60 * 1000 // months (approximately)
    };

    return value * multipliers[unit];
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (weeks > 0) return `${weeks}w`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}