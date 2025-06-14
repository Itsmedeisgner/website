const { 
    EmbedBuilder,
    ButtonStyle,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');
const ticketDB = require('../utils/ticketDatabase');
const errorHandler = require('../utils/errorHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        try {
            // Load guild config
            const config = await guildConfig.loadGuildConfig(interaction.guildId);

            // Handle Claim Ticket
            if (interaction.customId === 'claim_ticket') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    // Check if user has staff role
                    const hasStaffRole = interaction.member.roles.cache.some(role => 
                        config.ticketSystem.roles.staff.includes(role.id)
                    );

                    if (!hasStaffRole) {
                        return await interaction.editReply({
                            content: '❌ You need the staff role to claim tickets.',
                            ephemeral: true
                        });
                    }

                    const channel = interaction.channel;
                    
                    // Check if ticket exists in database
                    const ticket = await ticketDB.getTicket(channel.id, interaction.guildId);
                    if (!ticket) {
                        return await interaction.editReply({
                            content: '❌ Could not find ticket data.',
                            ephemeral: true
                        });
                    }

                    // Check if ticket is already claimed
                    if (ticket.status === 'claimed') {
                        const claimer = await interaction.guild.members.fetch(ticket.claimedBy);
                        return await interaction.editReply({
                            content: `❌ This ticket has already been claimed by ${claimer}`,
                            ephemeral: true
                        });
                    }

                    // Update ticket status in database
                    await ticketDB.updateTicket(channel.id, interaction.guildId, {
                        status: 'claimed',
                        claimedBy: interaction.user.id,
                        claimedAt: new Date().toISOString()
                    });

                    // Create claim embed
                    const claimEmbed = new EmbedBuilder()
                        .setColor(config.ticketSystem.settings.embedColors.claim)
                        .setTitle('🎫 Ticket Claimed')
                        .setDescription(`${interaction.user} has claimed this ticket.\nThey will assist you shortly.`)
                        .setTimestamp();

                    // Create new buttons with claim button disabled
                    const updatedButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('claim_ticket')
                                .setLabel('Claimed')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('✅')
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('delete_ticket')
                                .setLabel('Delete Ticket')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('❌')
                        );

                    // Update the original message
                    await interaction.message.edit({ components: [updatedButtons] });
                    await channel.send({ embeds: [claimEmbed] });

                    // Send log
                    if (config.ticketSystem.channels.logs) {
                        const logChannel = interaction.guild.channels.cache.get(config.ticketSystem.channels.logs);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(config.ticketSystem.settings.embedColors.claim)
                                .setTitle('Ticket Claimed')
                                .setDescription(`**Ticket:** ${channel.name}\n**Claimed by:** ${interaction.user.tag}\n**User:** <@${ticket.userId}>`)
                                .setTimestamp();
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }

                    await interaction.editReply({
                        content: 'You have successfully claimed this ticket.',
                        ephemeral: true
                    });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply({
                        content: '❌ There was an error claiming the ticket.',
                        ephemeral: true
                    });
                }
            }

            // Handle Delete Ticket
            if (interaction.customId === 'delete_ticket') {
                await interaction.deferReply();

                try {
                    const channel = interaction.channel;
                    const ticket = await ticketDB.getTicket(channel.id, interaction.guildId);

                    // Check if user has permission to delete
                    const hasStaffRole = interaction.member.roles.cache.some(role => 
                        config.ticketSystem.roles.staff.includes(role.id)
                    );
                    const isTicketCreator = ticket && ticket.userId === interaction.user.id;

                    if (!hasStaffRole && !isTicketCreator) {
                        return await interaction.editReply({
                            content: '❌ You don\'t have permission to delete this ticket.',
                            ephemeral: true
                        });
                    }

                    // Create delete embed
                    const deleteEmbed = new EmbedBuilder()
                        .setColor(config.ticketSystem.settings.embedColors.close)
                        .setDescription(`This room will be deleted in ${config.ticketSystem.settings.deleteTimeout / 1000} seconds.`);

                    await interaction.editReply({ embeds: [deleteEmbed] });

                    // Update ticket status
                    await ticketDB.updateTicket(channel.id, interaction.guildId, {
                        status: 'closed',
                        closedAt: new Date().toISOString()
                    });

                    // Create transcript
                    if (config.ticketSystem.settings.transcriptEnabled && config.ticketSystem.channels.transcript) {
                        const messages = await channel.messages.fetch({ limit: 100 });
                        let transcript = [
                            `Ticket Transcript: ${channel.name}`,
                            `Created: ${ticket.createdAt}`,
                            `Closed: ${new Date().toISOString()}`,
                            `Closed by: ${interaction.user.tag} (${interaction.user.id})`,
                            '\nMessages:\n'
                        ].join('\n');
                        
                        messages.reverse().forEach(msg => {
                            transcript += `\n[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}`;
                            msg.attachments.forEach(attachment => {
                                transcript += `\n[Attachment: ${attachment.url}]`;
                            });
                        });

                        const transcriptBuffer = Buffer.from(transcript, 'utf8');
                        const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, { 
                            name: `transcript-${channel.name}.txt` 
                        });

                        const transcriptChannel = interaction.guild.channels.cache.get(
                            config.ticketSystem.channels.transcript
                        );

                        if (transcriptChannel) {
                            const transcriptEmbed = new EmbedBuilder()
                                .setColor(config.ticketSystem.settings.embedColors.close)
                                .setTitle('Ticket Transcript')
                                .setDescription([
                                    `**Ticket:** ${channel.name}`,
                                    `**Created By:** <@${ticket.userId}>`,
                                    `**Closed By:** ${interaction.user.tag}`,
                                    `**Duration:** ${getTimeDifference(ticket.createdAt, new Date())}`
                                ].join('\n'))
                                .setTimestamp();

                            await transcriptChannel.send({
                                embeds: [transcriptEmbed],
                                files: [transcriptAttachment]
                            });
                        }
                    }

                    // Send log
                    if (config.ticketSystem.channels.logs) {
                        const logChannel = interaction.guild.channels.cache.get(config.ticketSystem.channels.logs);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(config.ticketSystem.settings.embedColors.close)
                                .setTitle('Ticket Closed')
                                .setDescription(`**Ticket:** ${channel.name}\n**Closed by:** ${interaction.user.tag}`)
                                .setTimestamp();
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }

                    // Delete the channel after timeout
                    setTimeout(async () => {
                        try {
                            await channel.delete();
                        } catch (error) {
                            console.error('Error deleting channel:', error);
                        }
                    }, config.ticketSystem.settings.deleteTimeout);

                } catch (error) {
                    console.error(error);
                    await interaction.editReply({
                        content: 'There was an error closing the ticket.',
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            await errorHandler.handleButtonError(interaction, error);
        }
    },
};

function getTimeDifference(start, end) {
    const diff = Math.abs(new Date(end) - new Date(start));
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}