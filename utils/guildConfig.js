const fs = require('fs');
const path = require('path');

class GuildConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../data/guildConfigs');
        this.ensureConfigDirectory();
        this.cache = new Map();
    }

    ensureConfigDirectory() {
        if (!fs.existsSync(this.configPath)) {
            fs.mkdirSync(this.configPath, { recursive: true });
        }
    }

    getDefaultConfig() {
        return {
            ticketSystem: {
                enabled: false,
                channels: {
                    category: null,
                    logs: null,
                    transcript: null,
                    ticketPanel: null
                },
                roles: {
                    staff: []
                },
                settings: {
                    embedColors: {
                        main: "#2f3136",
                        claim: "#3498db",
                        close: "#e74c3c"
                    },
                    ticketNameFormat: "ticket-{username}-{count}",
                    maxTicketsPerUser: 1,
                    deleteTimeout: 5000,
                    transcriptEnabled: true
                }
            },
            statistics: {
                totalTickets: 0,
                activeTickets: 0,
                lastTicketId: 0,
                commandsUsed: 0
            },
            setupComplete: false,
            lastUpdated: new Date().toISOString(),
            logChannels: {
                roleLog: null,
                channelLog: null,
                messageLog: null,
                voiceLog: null
            }
        };
    }

    async loadGuildConfig(guildId) {
        if (!guildId) throw new Error('Guild ID is required');

        // Check cache first
        if (this.cache.has(guildId)) {
            return this.cache.get(guildId);
        }

        const configFile = path.join(this.configPath, `${guildId}.json`);
        
        try {
            if (!fs.existsSync(configFile)) {
                const defaultConfig = this.getDefaultConfig();
                await this.saveGuildConfig(guildId, defaultConfig);
                return defaultConfig;
            }

            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            const mergedConfig = this.mergeWithDefaults(config);
            this.cache.set(guildId, mergedConfig);

            // Ensure logChannels exists
            if (!config.logChannels) {
                config.logChannels = {
                    roleLog: null,
                    channelLog: null,
                    messageLog: null,
                    voiceLog: null,
                    moderationLog: null
                };
                await this.saveGuildConfig(guildId, config);
            }
            
            return config;
        } catch (error) {
            console.error(`Error loading guild config for ${guildId}:`, error);
            return this.getDefaultConfig();
        }
    }

    async removeGuildConfig(guildId) {
        const configFile = path.join(this.configPath, `${guildId}.json`);
        try {
            if (fs.existsSync(configFile)) {
                fs.unlinkSync(configFile);
            }
            this.cache.delete(guildId);
            return true;
        } catch (error) {
            console.error(`Error removing config for guild ${guildId}:`, error);
            return false;
        }
    }

    mergeWithDefaults(config) {
        const defaultConfig = this.getDefaultConfig();
        return {
            ...defaultConfig,
            ...config,
            ticketSystem: {
                ...defaultConfig.ticketSystem,
                ...config.ticketSystem,
                channels: {
                    ...defaultConfig.ticketSystem.channels,
                    ...config.ticketSystem?.channels
                },
                roles: {
                    ...defaultConfig.ticketSystem.roles,
                    ...config.ticketSystem?.roles
                },
                settings: {
                    ...defaultConfig.ticketSystem.settings,
                    ...config.ticketSystem?.settings,
                    embedColors: {
                        ...defaultConfig.ticketSystem.settings.embedColors,
                        ...config.ticketSystem?.settings?.embedColors
                    }
                },
                messages: {
                    ...defaultConfig.ticketSystem.messages,
                    ...config.ticketSystem?.messages
                }
            },
            systemSettings: {
                ...defaultConfig.systemSettings,
                ...config.systemSettings
            },
            statistics: {
                ...defaultConfig.statistics,
                ...config.statistics
            }
        };
    }

    async saveGuildConfig(guildId, config) {
        const configFile = path.join(this.configPath, `${guildId}.json`);
        try {
            config.lastUpdated = new Date().toISOString();
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
            this.cache.set(guildId, config);
            return true;
        } catch (error) {
            console.error(`Error saving config for guild ${guildId}:`, error);
            return false;
        }
    }    async updateGuildConfig(guildId, updates) {
        const config = await this.loadGuildConfig(guildId);
        
        // Handle logChannels updates specially
        if (updates.logChannels) {
            config.logChannels = {
                ...config.logChannels,
                ...updates.logChannels
            };
            delete updates.logChannels;
        }
        
        const newConfig = this.mergeWithDefaults({
            ...config,
            ...updates,
            ticketSystem: {
                ...config.ticketSystem,
                ...(updates.ticketSystem || {}),
                enabled: updates.ticketSystem ? true : config.ticketSystem?.enabled
            },
            setupComplete: true
        });
        
        return this.saveGuildConfig(guildId, newConfig);
    }

    async incrementStatistic(guildId, stat) {
        const config = await this.loadGuildConfig(guildId);
        if (stat in config.statistics) {
            config.statistics[stat]++;
            await this.saveGuildConfig(guildId, config);
            return config.statistics[stat];
        }
        return null;
    }

    async isSetupComplete(guildId) {
        const config = await this.loadGuildConfig(guildId);
        return config.setupComplete === true;
    }

    clearCache(guildId) {
        if (guildId) {
            this.cache.delete(guildId);
        } else {
            this.cache.clear();
        }
    }
}

module.exports = new GuildConfigManager();