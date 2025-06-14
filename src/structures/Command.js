// src/structures/Command.js
class Command {
    constructor(options) {
        this.name = options.name;
        this.description = options.description;
        this.permissions = options.permissions || [];
        this.requiresSetup = options.requiresSetup || false;
        this.requiresStaff = options.requiresStaff || false;
        this.cooldown = options.cooldown || 0;
    }

    // Base validation method all commands will inherit
    async validate(interaction) {
        // Check permissions
        if (this.permissions.length > 0) {
            const missingPerms = this.permissions.filter(perm => 
                !interaction.member.permissions.has(perm)
            );
            if (missingPerms.length > 0) {
                await interaction.reply({
                    content: `❌ You need the following permissions: ${missingPerms.join(', ')}`,
                    ephemeral: true
                });
                return false;
            }
        }

        // Check setup requirements
        if (this.requiresSetup) {
            const config = await interaction.client.guildConfig.load(interaction.guildId);
            if (!config.setupComplete) {
                await interaction.reply({
                    content: '⚠️ This command requires setup first. Please run `/setup`.',
                    ephemeral: true
                });
                return false;
            }
        }

        // Check staff role requirement
        if (this.requiresStaff) {
            const config = await interaction.client.guildConfig.load(interaction.guildId);
            const hasStaffRole = interaction.member.roles.cache.some(role => 
                config.staffRoles.includes(role.id)
            );
            if (!hasStaffRole) {
                await interaction.reply({
                    content: '❌ This command requires the staff role.',
                    ephemeral: true
                });
                return false;
            }
        }

        return true;
    }

    // Method to handle errors consistently
    async handleError(interaction, error) {
        console.error(`Error in ${this.name} command:`, error);
        
        const errorMessage = error.userMessage || 'An unexpected error occurred.';
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: `❌ ${errorMessage}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `❌ ${errorMessage}`, 
                ephemeral: true
            });
        }
    }
}

module.exports = Command;