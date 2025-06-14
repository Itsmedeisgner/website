const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelType
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the ticket system')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the channel for the ticket system')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addChannelOption(option =>
            option.setName('logs')
                .setDescription('Select the channel for ticket logs')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addChannelOption(option =>
            option.setName('transcript')
                .setDescription('Select the channel for ticket transcripts')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Select the category for tickets')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('staffrole')
                .setDescription('Select the staff role')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.options.getChannel('channel');
            const logsChannel = interaction.options.getChannel('logs');
            const transcriptChannel = interaction.options.getChannel('transcript');
            const category = interaction.options.getChannel('category');
            const staffRole = interaction.options.getRole('staffrole');

            // Save guild-specific configuration
            await guildConfig.updateGuildConfig(interaction.guildId, {
                enabled: true,
                channels: {
                    category: category.id,
                    logs: logsChannel.id,
                    transcript: transcriptChannel.id,
                    ticketPanel: channel.id
                },
                roles: {
                    staff: [staffRole.id]
                }
            });

            // Create ticket panel embed
            const panelEmbed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('🎫 Ticket System')
                .setDescription('To contact technical support, please select an option below.')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ 
                    text: interaction.guild.name, 
                    iconURL: interaction.guild.iconURL() 
                });

            // Create dropdown menu
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_create')
                        .setPlaceholder('Open a ticket')
                        .addOptions([
                            {
                                label: 'Create Support Ticket',
                                description: 'Open a new support ticket',
                                value: 'create_ticket',
                                emoji: '📨'
                            },
                        ]),
                );

            // Send the panel with single embed
            await channel.send({
                embeds: [panelEmbed],
                components: [row]
            });

            // Store welcome message in guild config
            await guildConfig.updateGuildConfig(interaction.guildId, {
                ticketSystem: {
                    messages: {
                        welcome: 'To contact technical support, please select an option below.'
                    }
                }
            });

            // Send success message
            await interaction.editReply({
                content: `✅ Ticket system has been setup in ${channel}\nLogs: ${logsChannel}\nTranscripts: ${transcriptChannel}\nCategory: ${category}\nStaff Role: ${staffRole}`,
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ There was an error setting up the ticket system',
                ephemeral: true
            });
        }
    },
};