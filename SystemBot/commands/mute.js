const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user in this channel')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for muting')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Double-check permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.editReply({
                    content: '❌ You need Moderate Members permission to use this command.',
                    ephemeral: true
                });
            }

            // Check bot permissions
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.editReply({
                    content: '❌ I need Manage Roles permission to mute users.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const channel = interaction.channel;

            // Load guild config
            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            // Find or create Muted role
            let mutedRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
            
            if (!mutedRole) {
                try {
                    // Create the Muted role
                    mutedRole = await interaction.guild.roles.create({
                        name: 'Muted',
                        color: '#808080',
                        reason: 'Created for muting users',
                        permissions: []
                    });

                    // Store the role ID in guild config
                    await guildConfig.updateGuildConfig(interaction.guildId, {
                        systemSettings: {
                            mutedRoleId: mutedRole.id
                        }
                    });

                } catch (error) {
                    console.error('Error creating Muted role:', error);
                    return await interaction.editReply({
                        content: '❌ Failed to create the Muted role. Please check my permissions.',
                        ephemeral: true
                    });
                }
            }

            // Check if user is already muted in this channel
            const currentPerms = channel.permissionOverwrites.cache.get(targetUser.id);
            if (currentPerms?.deny.has('SendMessages')) {
                return await interaction.editReply({
                    content: '❌ This user is already muted in this channel.',
                    ephemeral: true
                });
            }

            // Check if user is moderatable
            if (!targetMember.moderatable) {
                return await interaction.editReply({
                    content: '❌ I cannot mute this user due to role hierarchy.',
                    ephemeral: true
                });
            }

            // Set up channel-specific mute
            await channel.permissionOverwrites.edit(targetUser, {
                SendMessages: false,
                SendMessagesInThreads: false,
                CreatePublicThreads: false,
                CreatePrivateThreads: false,
                AddReactions: false
            });

            // Apply mute role
            await targetMember.roles.add(mutedRole, reason);

            // Create success embed
            const muteEmbed = new EmbedBuilder()
                .setColor('#808080')
                .setTitle('User Muted')
                .setDescription([
                    `**User:** ${targetUser.tag}`,
                    `**Channel:** ${channel}`,
                    `**Reason:** ${reason}`,
                    `**Muted by:** ${interaction.user.tag}`
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [muteEmbed] });

            // Log the moderation action
            await interaction.client.logManager.logModAction(
                interaction.guild,
                'MUTE',
                {
                    target: `${targetUser.tag} (${targetUser.id})`,
                    moderator: interaction.user,
                    reason: reason,
                    additionalFields: [
                        { name: '📝 Channel', value: channel.toString(), inline: true },
                        { name: '🔒 Role', value: mutedRole.name, inline: true }
                    ]
                }
            );

            // Try to DM the user
            try {
                await targetUser.send({
                    content: `You have been muted in #${channel.name} (${interaction.guild.name})\nReason: ${reason}`
                });
            } catch (error) {
                console.log('Could not DM user about mute');
            }

        } catch (error) {
            console.error('Mute command error:', error);
            await interaction.editReply({
                content: '❌ There was an error executing the mute command.',
                ephemeral: true
            });
        }
    },
};