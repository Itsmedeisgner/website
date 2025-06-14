const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

class ErrorHandler {
    constructor() {
        this.logPath = path.join(__dirname, '../data/error_logs.txt');
        this.ensureLogFile();
        this.logChannels = new Map(); // Store log channels per guild
    }

    ensureLogFile() {
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.logPath)) {
            fs.writeFileSync(this.logPath, '');
        }
    }

    setLogChannel(guildId, channel) {
        this.logChannels.set(guildId, channel);
    }

    async logError(error, context = '', guildId = null) {
        const timestamp = new Date().toISOString();
        const errorLog = `[${timestamp}] ${context}\n${error.stack}\n\n`;

        // Log to file
        fs.appendFileSync(this.logPath, errorLog);

        // Log to console
        console.error(`[ERROR] ${context}:`, error);

        try {
            // Send to guild-specific log channel if available
            if (guildId && this.logChannels.has(guildId)) {
                const logChannel = this.logChannels.get(guildId);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⚠️ Bot Error Detected')
                    .setDescription(`**Context:** ${context}\n\n**Error:** \`\`\`${error.message}\`\`\``)
                    .setTimestamp();

                await logChannel.send({ embeds: [errorEmbed] });
            }
        } catch (e) {
            console.error('Error sending error log to Discord:', e);
        }
    }

    async handleCommandError(interaction, error) {
        await this.logError(error, `Command: ${interaction.commandName}`, interaction.guildId);

        try {
            const response = {
                content: '⚠️ Something went wrong. The issue has been logged and will be fixed soon.',
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(response);
            } else {
                await interaction.reply(response);
            }
        } catch (e) {
            console.error('Error sending error response:', e);
        }
    }

    async handleButtonError(interaction, error) {
        await this.logError(error, `Button: ${interaction.customId}`, interaction.guildId);

        try {
            const response = {
                content: '⚠️ There was an error processing this button. Please try again later.',
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(response);
            } else {
                await interaction.reply(response);
            }
        } catch (e) {
            console.error('Error sending error response:', e);
        }
    }

    setupGlobalHandlers(client) {
        process.on('unhandledRejection', async (error) => {
            await this.logError(error, 'Unhandled Promise Rejection');
        });

        process.on('uncaughtException', async (error) => {
            await this.logError(error, 'Uncaught Exception');
            // Optionally restart the bot here
        });

        client.on('error', async (error) => {
            await this.logError(error, 'Discord Client Error');
        });
    }
}

module.exports = new ErrorHandler();