const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Display all server roles'),

    async execute(interaction) {
        const roles = interaction.guild.roles.cache
            .sort((a, b) => b.position - a.position)
            .filter(role => role.id !== interaction.guild.id)
            .map(role => ({
                name: role.name,
                id: role.id,
                members: role.members.size,
                color: role.hexColor
            }));

        const rolesPerPage = 10;
        const pages = Math.ceil(roles.length / rolesPerPage);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * rolesPerPage;
            const end = start + rolesPerPage;
            const currentRoles = roles.slice(start, end);

            return new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle(`Server Roles (${roles.length} total)`)
                .setDescription(currentRoles.map(role => 
                    `<@&${role.id}> - ${role.members} members`
                ).join('\n'))
                .setFooter({ text: `Page ${page + 1}/${pages}` });
        };

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pages <= 1)
            );

        const response = await interaction.reply({
            embeds: [generateEmbed(0)],
            components: [row],
            fetchReply: true
        });

        if (pages <= 1) return;

        const collector = response.createMessageComponentCollector({
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ 
                    content: 'This is not your roles list.', 
                    ephemeral: true 
                });
            }

            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            }

            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage === pages - 1);

            try {
                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [row]
                });
            } catch (error) {
                console.error('Error updating message:', error);
                collector.stop();
            }
        });

        collector.on('end', async () => {
            try {
                // Try to edit the message to disable buttons
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                await response.edit({ components: [disabledRow] }).catch(() => {
                    // Ignore errors if message is deleted
                    console.log('Could not update message - it may have been deleted');
                });
            } catch (error) {
                console.error('Error disabling buttons:', error);
            }
        });
    },
};