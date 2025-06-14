const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a muted user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unmuting')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Check permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) && 
                !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ You need Moderate Members or Administrator permission to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const channel = interaction.channel;

            // Load guild config
            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            // Check if bot can manage roles
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.editReply({
                    content: '❌ I need Manage Roles permission to unmute users.',
                    ephemeral: true
                });
            }

            // Find Muted role
            const mutedRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
            
            if (!mutedRole) {
                return await interaction.editReply({
                    content: '❌ Could not find the Muted role.',
                    ephemeral: true
                });
            }

            // Check if user has Muted role
            if (!targetMember.roles.cache.has(mutedRole.id)) {
                return await interaction.editReply({
                    content: '❌ This user is not muted.',
                    ephemeral: true
                });
            }

            // Check if user is moderatable
            if (!targetMember.moderatable) {
                return await interaction.editReply({
                    content: '❌ I cannot unmute this user due to role hierarchy.',
                    ephemeral: true
                });
            }

            // Remove Muted role
            await targetMember.roles.remove(mutedRole, reason);

            // Reset channel permissions
            await channel.permissionOverwrites.delete(targetUser.id);

            // Create success embed
            const unmuteEmbed = new EmbedBuilder()
                .setColor('#43b581')
                .setTitle('User Unmuted')
                .setDescription([
                    `**User:** ${targetUser.tag}`,
                    `**Channel:** ${channel}`,
                    `**Reason:** ${reason}`,
                    `**Unmuted by:** ${interaction.user.tag}`
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [unmuteEmbed] });

            // Log the unmute if logs channel is configured
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(
                    config.ticketSystem.channels.logs
                );
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#43b581')
                        .setTitle('User Unmuted')
                        .setDescription([
                            `**User:** ${targetUser.tag} (${targetUser.id})`,
                            `**Channel:** ${channel.name}`,
                            `**Reason:** ${reason}`,
                            `**Unmuted by:** ${interaction.user.tag}`
                        ].join('\n'))
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            // Try to DM the user
            try {
                await targetUser.send({
                    content: `You have been unmuted in #${channel.name} (${interaction.guild.name})\nReason: ${reason}`
                });
            } catch (error) {
                console.log('Could not DM user about unmute');
            }

        } catch (error) {
            console.error('Unmute command error:', error);
            await interaction.editReply({
                content: '❌ There was an error executing the unmute command.',
                ephemeral: true
            });
        }
    },
};