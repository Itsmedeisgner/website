const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Display user profile information')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get info about')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id);

        // Calculate account age
        const createdAt = Math.floor(targetUser.createdTimestamp / 1000);
        const joinedAt = Math.floor(member.joinedTimestamp / 1000);

        // Format roles with character limit handling
        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.id) // Filter out @everyone
            .sort((a, b) => b.position - a.position); // Sort by position

        let rolesFormatted = roles.size > 0 
            ? roles.map(role => `<@&${role.id}>`).join(', ')
            : 'No roles';

        // If roles string is too long, show count instead
        if (rolesFormatted.length > 1024) {
            rolesFormatted = `${roles.size} roles (Too many to display)`;
        }

        const profileEmbed = new EmbedBuilder()
            .setColor(member.displayHexColor || '#2f3136')
            .setTitle(`${targetUser.tag}'s Profile`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 1024 }))
            .addFields(
                { name: '🆔 User ID', value: targetUser.id, inline: true },
                { name: '📆 Account Created', value: `<t:${createdAt}:R>`, inline: true },
                { name: '📥 Joined Server', value: `<t:${joinedAt}:R>`, inline: true },
                { name: '🎭 Roles', value: rolesFormatted, inline: false },
                { 
                    name: '🎯 Status', 
                    value: member.presence?.status ? `${getStatusEmoji(member.presence.status)} ${capitalize(member.presence.status)}` : '⚫ Offline',
                    inline: true 
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [profileEmbed] });
    },
};

function getStatusEmoji(status) {
    const statuses = {
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
        offline: '⚫'
    };
    return statuses[status] || '⚫';
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}