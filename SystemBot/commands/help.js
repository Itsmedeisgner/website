const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder 
} = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands and their usage')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Specific category to show help for')
                .addChoices(
                    { name: 'System Commands', value: 'system' },
                    { name: 'Ticket Commands', value: 'ticket' },
                    { name: 'Setup Guide', value: 'setup' }
                )
                .setRequired(false)),

    async execute(interaction) {
        try {
            const category = interaction.options.getString('category');
            const commands = interaction.client.commands;
            
            // Updated category detection
            function getCommandCategory(command) {
                const ticketCommands = ['setup', 'adduser', 'removeuser', 'editmessage'];
                return ticketCommands.includes(command.data.name) ? 'ticket' : 'system';
            }

            // Group commands by category
            const systemCommands = [];
            const ticketCommands = [];
            
            commands.forEach(cmd => {
                const category = getCommandCategory(cmd);
                const commandInfo = {
                    name: cmd.data.name,
                    description: cmd.data.description,
                    options: cmd.data.options?.map(opt => ({
                        name: opt.name,
                        description: opt.description,
                        required: opt.required
                    })) || []
                };

                if (category === 'system') {
                    systemCommands.push(commandInfo);
                } else {
                    ticketCommands.push(commandInfo);
                }
            });

            // Create setup guide embed
            const setupEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('🔧 Setup Guide')
                .setDescription('Follow these steps to set up the bot:')
                .addFields([
                    {
                        name: '1️⃣ Initial Setup',
                        value: 'Run `/setup` to configure:\n• Ticket Category\n• Log Channels\n• Staff Roles'
                    },
                    {
                        name: '2️⃣ Permissions',
                        value: 'Ensure the bot has these permissions:\n• Manage Channels\n• Manage Roles\n• View Channels\n• Send Messages'
                    },
                    {
                        name: '3️⃣ Staff Setup',
                        value: 'Assign staff roles to moderators who should handle tickets'
                    },
                    {
                        name: '4️⃣ Test',
                        value: 'Create a test ticket to verify everything works'
                    }
                ]);

            // Create system commands embed
            const systemEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('⚙️ System Commands')
                .setDescription('Moderation and utility commands:')
                .addFields(
                    systemCommands.map(cmd => ({
                        name: `/${cmd.name}`,
                        value: `${cmd.description}\n${cmd.options.length > 0 ? 
                            '**Options:**\n' + cmd.options.map(opt => 
                                `• \`${opt.name}\`: ${opt.description}${opt.required ? ' (Required)' : ''}`
                            ).join('\n') : 
                            '**Options:** None'}`
                    }))
                );

            // Create ticket commands embed
            const ticketEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('🎫 Ticket Commands')
                .setDescription('Commands for managing the ticket system:')
                .addFields([
                    {
                        name: '⚙️ `/setup`',
                        value: [
                            'Configure the ticket system for your server.',
                            '',
                            '**Required Options:**',
                            '• `channel` - Where ticket panel will be displayed',
                            '• `logs` - Channel for ticket activity logs',
                            '• `transcript` - Channel for ticket transcripts',
                            '• `category` - Category for ticket channels',
                            '• `staffrole` - Role that can manage tickets',
                            '',
                            '**Note:** Requires Administrator permission'
                        ].join('\n')
                    },
                    {
                        name: '➕ `/adduser`',
                        value: [
                            'Add a user to an existing ticket.',
                            '',
                            '**Options:**',
                            '• `user` - The user to add (Required)',
                            '',
                            '**Note:** Can only be used in ticket channels'
                        ].join('\n')
                    },
                    {
                        name: '➖ `/removeuser`',
                        value: [
                            'Remove a user from a ticket channel.',
                            '',
                            '**Options:**',
                            '• `user` - The user to remove (Required)',
                            '',
                            '**Note:** Cannot remove ticket creator or staff'
                        ].join('\n')
                    },
                    {
                        name: '✏️ `/editmessage`',
                        value: [
                            'Edit the ticket panel\'s welcome message.',
                            '',
                            '**Options:**',
                            '• `message` - New message to display (Required)',
                            '',
                            '**Note:** Requires Administrator permission'
                        ].join('\n')
                    }
                ]);

            // Create navigation buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_help')
                        .setLabel('Setup Guide')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔧'),
                    new ButtonBuilder()
                        .setCustomId('system_help')
                        .setLabel('System Commands')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️'),
                    new ButtonBuilder()
                        .setCustomId('ticket_help')
                        .setLabel('Ticket Commands')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🎫')
                );

            // Send initial embed based on category
            let initialEmbed;
            switch(category) {
                case 'system':
                    initialEmbed = systemEmbed;
                    break;
                case 'ticket':
                    initialEmbed = ticketEmbed;
                    break;
                case 'setup':
                    initialEmbed = setupEmbed;
                    break;
                default:
                    initialEmbed = setupEmbed;
            }

            const response = await interaction.reply({
                embeds: [initialEmbed],
                components: [buttons],
                fetchReply: true
            });

            // Create button collector
            const collector = response.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: 'This help menu is not for you.',
                        ephemeral: true
                    });
                }

                let embed;
                switch(i.customId) {
                    case 'setup_help':
                        embed = setupEmbed;
                        break;
                    case 'system_help':
                        embed = systemEmbed;
                        break;
                    case 'ticket_help':
                        embed = ticketEmbed;
                        break;
                }

                await i.update({
                    embeds: [embed],
                    components: [buttons]
                });
            });

            collector.on('end', () => {
                // Disable all buttons
                buttons.components.forEach(button => button.setDisabled(true));
                interaction.editReply({ components: [buttons] }).catch(() => {});
            });

        } catch (error) {
            console.error('Help command error:', error);
            await interaction.reply({
                content: '❌ There was an error fetching the help information.',
                ephemeral: true
            });
        }
    },
};