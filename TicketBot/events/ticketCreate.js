const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');
const ticketDB = require('../utils/ticketDatabase');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'ticket_create') return;

        try {
            // Load guild config
            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            // Defer the reply immediately
            await interaction.deferReply({ ephemeral: true });

            // Check if user has reached ticket limit
            const userOpenTickets = await ticketDB.getUserOpenTickets(interaction.user.id, interaction.guildId);
            if (userOpenTickets >= config.ticketSystem.settings.maxTicketsPerUser) {
                return await interaction.editReply({
                    content: '❌ You already have an open ticket. Please close your existing ticket before creating a new one.',
                    ephemeral: true
                });
            }

            // Reset the select menu interaction
            await interaction.message.edit({ components: [interaction.message.components[0]] });

            const user = interaction.user;
            const ticketNumber = String(Date.now()).slice(-3);
            const channelName = config.ticketSystem.settings.ticketNameFormat
                .replace('{username}', user.username)
                .replace('{count}', ticketNumber);

            // Create base permission overwrites with staff role
            const permissionOverwrites = [
                {
                    id: interaction.guild.id,
                    deny: ['ViewChannel'],
                },
                {
                    id: user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                }
            ];

            // Add staff role permissions
            if (config.ticketSystem.roles.staff && config.ticketSystem.roles.staff.length > 0) {
                for (const roleId of config.ticketSystem.roles.staff) {
                    permissionOverwrites.push({
                        id: roleId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'],
                    });
                }
            }

            // Create the ticket channel in the correct category
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: 0, // Text channel
                parent: config.ticketSystem.channels.category,
                permissionOverwrites: permissionOverwrites,
                reason: `Ticket created by ${user.tag}`
            });

            // Create ticket in database
            await ticketDB.createTicket({
                ticketId: ticketChannel.id,
                userId: user.id,
                guildId: interaction.guildId,
                channelName: channelName,
                ticketNumber: ticketNumber
            });

            // Send log message
            if (config.ticketSystem.channels.logs) {
                const logChannel = interaction.guild.channels.cache.get(config.ticketSystem.channels.logs);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(config.ticketSystem.settings.embedColors.main)
                        .setTitle('New Ticket Created')
                        .setDescription([
                            `**Ticket:** ${channelName}`,
                            `**Created By:** ${user.tag} (${user.id})`,
                            `**Category:** ${interaction.guild.channels.cache.get(config.ticketSystem.channels.category)?.name || 'Unknown'}`
                        ].join('\n'))
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            // Create embed for the ticket channel
            const ticketEmbed = new EmbedBuilder()
                .setColor(config.ticketSystem.settings.embedColors.main)
                .setTitle('🎫 Ticket Support')
                .setDescription(config.ticketSystem.messages?.welcome || 'Please wait for a staff member to assist you.')
                .setTimestamp()
                .setFooter({ 
                    text: interaction.guild.name, 
                    iconURL: interaction.guild.iconURL() 
                });

            // Create buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('Claim Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('delete_ticket')
                        .setLabel('Delete Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

            // Send embed with buttons to the ticket channel
            await ticketChannel.send({
                embeds: [ticketEmbed],
                components: [buttons]
            });

            // Edit the deferred reply
            await interaction.editReply({
                content: `Your ticket has been created: ${ticketChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: 'There was an error creating your ticket!',
                ephemeral: true
            });
        }
    },
};