const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');
const guildConfig = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editmessage')
        .setDescription('Edit the ticket panel message')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The new message to display')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const config = await guildConfig.loadGuildConfig(interaction.guildId);
            const newMessage = interaction.options.getString('message');

            // Update the message in config
            await guildConfig.updateGuildConfig(interaction.guildId, {
                ticketSystem: {
                    messages: {
                        welcome: newMessage
                    }
                }
            });

            // Find and update the panel embed
            const ticketChannel = interaction.guild.channels.cache.get(
                config.ticketSystem.channels.ticketPanel
            );

            if (ticketChannel) {
                const messages = await ticketChannel.messages.fetch();
                const panelMessage = messages.find(msg => 
                    msg.embeds?.length > 0 && 
                    msg.embeds[0].title === '🎫 Ticket System'
                );

                if (panelMessage) {
                    const panelEmbed = EmbedBuilder.from(panelMessage.embeds[0])
                        .setDescription(newMessage);

                    await panelMessage.edit({
                        embeds: [panelEmbed],
                        components: panelMessage.components
                    });
                }
            }

            await interaction.editReply({
                content: '✅ Ticket panel message has been updated!',
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ There was an error updating the ticket panel message',
                ephemeral: true
            });
        }
    },
};