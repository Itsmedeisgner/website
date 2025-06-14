const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages from the channel')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Clear messages from a specific user')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to clear (max 100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            // Defer the reply to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const amount = interaction.options.getInteger('amount') || 100;
            const user = interaction.options.getUser('user');
            const channel = interaction.channel;

            // Check if channel is text channel
            if (channel.type !== ChannelType.GuildText) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in text channels.',
                    ephemeral: true
                });
            }

            // Fetch more messages than requested to ensure we get enough after filtering
            const fetchAmount = user ? Math.min(amount * 2, 100) : amount;
            const messages = await channel.messages.fetch({ limit: fetchAmount });
            
            let messagesToDelete;
            if (user) {
                // Filter messages by user and take only the requested amount
                const userMessages = messages.filter(msg => msg.author.id === user.id);
                
                if (!userMessages.size) {
                    return await interaction.editReply({
                        content: `❌ No messages found from ${user.tag} in the last ${fetchAmount} messages.`,
                        ephemeral: true
                    });
                }

                messagesToDelete = userMessages.first(amount);
            } else {
                messagesToDelete = messages.first(amount);
            }

            if (!messagesToDelete.length) {
                return await interaction.editReply({
                    content: '❌ No messages found to delete.',
                    ephemeral: true
                });
            }

            try {
                // Delete messages
                const deletedMessages = await channel.bulkDelete(messagesToDelete, true);

                // Send success message with details
                const response = user
                    ? `✅ Successfully deleted ${deletedMessages.size} message${deletedMessages.size === 1 ? '' : 's'} from ${user.tag}.`
                    : `✅ Successfully deleted ${deletedMessages.size} message${deletedMessages.size === 1 ? '' : 's'}.`;

                await interaction.editReply({
                    content: response,
                    ephemeral: true
                });

            } catch (error) {
                // Handle specific error cases
                if (error.code === 50034) {
                    return await interaction.editReply({
                        content: '❌ Cannot delete messages older than 14 days.',
                        ephemeral: true
                    });
                }
                
                if (error.code === 50013) {
                    return await interaction.editReply({
                        content: '❌ I don\'t have permission to delete messages in this channel.',
                        ephemeral: true
                    });
                }

                throw error; // Re-throw unhandled errors
            }

        } catch (error) {
            console.error('Clear command error:', error);
            
            try {
                await interaction.editReply({
                    content: '❌ An error occurred while trying to clear messages.',
                    ephemeral: true
                });
            } catch (e) {
                console.error('Error sending error response:', e);
            }
        }
    },
};