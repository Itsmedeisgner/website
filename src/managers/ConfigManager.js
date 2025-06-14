// src/managers/ConfigManager.js
const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor(client) {
        this.client = client;
        this.cache = new Map();
        this.configPath = path.join(process.cwd(), 'data', 'configs');
    }

    async load(guildId) {
        // Check cache first
        if (this.cache.has(guildId)) {
            return this.cache.get(guildId);
        }

        // Load from file
        try {
            const filePath = path.join(this.configPath, `${guildId}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            const config = JSON.parse(data);
            
            // Merge with defaults and validate
            const validConfig = this.validate(config);
            this.cache.set(guildId, validConfig);
            
            return validConfig;
        } catch (error) {
            // Return default config if file doesn't exist
            if (error.code === 'ENOENT') {
                const defaultConfig = this.getDefaultConfig();
                await this.save(guildId, defaultConfig);
                return defaultConfig;
            }
            throw error;
        }
    }

    async save(guildId, config) {
        const validConfig = this.validate(config);
        
        // Update cache
        this.cache.set(guildId, validConfig);

        // Save to file
        const filePath = path.join(this.configPath, `${guildId}.json`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(validConfig, null, 2));

        return validConfig;
    }

    validate(config) {
        const defaultConfig = this.getDefaultConfig();
        return {
            ...defaultConfig,
            ...config,
            // Add validation for required fields
            staffRoles: Array.isArray(config.staffRoles) ? config.staffRoles : defaultConfig.staffRoles,
            logChannels: {
                ...defaultConfig.logChannels,
                ...(config.logChannels || {}),
            }
        };
    }

    getDefaultConfig() {
        return {
            setupComplete: false,
            staffRoles: [],
            logChannels: {
                mod: null,
                server: null,
                voice: null
            },
            ticketSystem: {
                enabled: false,
                category: null,
                logChannel: null,
                staffRole: null
            }
        };
    }
}

module.exports = ConfigManager;