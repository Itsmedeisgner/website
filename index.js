const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    ActivityType, 
    ChannelType, 
    EmbedBuilder,
    PermissionFlagsBits,
    AuditLogEvent
} = require('discord.js');
const { token } = require('./config.json');
const guildConfig = require('./utils/guildConfig');
const errorHandler = require('./TicketBot/utils/errorHandler');
const fs = require('fs');
const path = require('path');
const ticketDB = require('./TicketBot/utils/ticketDatabase');
const logManager = require('./utils/LogManager'); // Add to the top of index.js with other imports
const ConsoleCommands = require('./utils/console-commands');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();

// Load commands from TicketBot
const ticketCommandsPath = path.join(__dirname, 'TicketBot', 'commands');
const ticketCommandFiles = fs.readdirSync(ticketCommandsPath).filter(file => file.endsWith('.js'));

for (const file of ticketCommandFiles) {
    const filePath = path.join(ticketCommandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Load commands from SystemBot
const systemCommandsPath = path.join(__dirname, 'SystemBot', 'commands');
const systemCommandFiles = fs.readdirSync(systemCommandsPath).filter(file => file.endsWith('.js'));

for (const file of systemCommandFiles) {
    const filePath = path.join(systemCommandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Load events from TicketBot
const ticketEventsPath = path.join(__dirname, 'TicketBot', 'events');
const ticketEventFiles = fs.readdirSync(ticketEventsPath).filter(file => file.endsWith('.js'));

for (const file of ticketEventFiles) {
    const filePath = path.join(ticketEventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Update setupRequiredCommands to only include TicketBot commands
const setupRequiredCommands = [
    'adduser', 
    'removeuser', 
    'ticket'
];

// Add separate arrays for moderation commands that need staff role
const staffRequiredCommands = [
    'lock',
    'unlock',
    'clear',
    'hide',
    'visible'
];

// Free commands that don't need setup or staff role
const freeCommands = [
    'ping',
    'server',
    'profile',
    'roles',
    'help'
];

// Add permission requirements map
const commandPermissions = {
    // Moderation commands
    ban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    mute: PermissionFlagsBits.ModerateMembers,
    unmute: PermissionFlagsBits.ModerateMembers,
    timeout: PermissionFlagsBits.ModerateMembers,
    clear: PermissionFlagsBits.ManageMessages,
    
    // Channel management commands
    lock: PermissionFlagsBits.ManageChannels,
    unlock: PermissionFlagsBits.ManageChannels,
    hide: PermissionFlagsBits.ManageChannels,
    visible: PermissionFlagsBits.ManageChannels,
    
    // Role commands
    roles: PermissionFlagsBits.ViewChannel, // Read-only command
    
    // Utility commands
    ping: null, // No special permissions needed
    profile: null, // No special permissions needed
    server: null, // No special permissions needed
    help: null, // No special permissions needed
};

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // Check if command requires setup (only Ticket system commands)
        if (setupRequiredCommands.includes(command.data.name)) {
            const config = await guildConfig.loadGuildConfig(interaction.guildId);
            
            if (!config.setupComplete) {
                return await interaction.reply({
                    content: '⚠️ The ticket system needs to be configured first! Please have an administrator run `/setup`.',
                    ephemeral: true
                });
            }

            // Check for staff role requirement for ticket commands
            if (config.ticketSystem.roles.staff.length > 0) {
                const hasStaffRole = interaction.member.roles.cache.some(role => 
                    config.ticketSystem.roles.staff.includes(role.id)
                );

                if (!hasStaffRole) {
                    return await interaction.reply({
                        content: '❌ You need the ticket staff role to use this command.',
                        ephemeral: true
                    });
                }
            }
        }
        
        // Check for staff/admin requirements for moderation commands
        if (staffRequiredCommands.includes(command.data.name)) {
            // Check if user has MANAGE_CHANNELS or ADMINISTRATOR permission
            if (!interaction.member.permissions.has('ManageChannels') && 
                !interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({
                    content: '❌ You need Manage Channels or Administrator permission to use this command.',
                    ephemeral: true
                });
            }
        }

        // Check required permissions
        const requiredPermission = commandPermissions[command.data.name];
        if (requiredPermission) {
            if (!interaction.member.permissions.has(requiredPermission)) {
                const permissionName = Object.keys(PermissionFlagsBits)
                    .find(key => PermissionFlagsBits[key] === requiredPermission)
                    ?.replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, l => l.toUpperCase());

                return await interaction.reply({
                    content: `❌ You need the "${permissionName}" permission to use this command.`,
                    ephemeral: true
                });
            }
        }

        // Execute the command
        await command.execute(interaction);

    } catch (error) {
        console.error(`Command execution error:`, error);
        await errorHandler.handleCommandError(interaction, error);
    }
});

// Remove all other activities arrays and updateStatus functions
// Keep only these versions:

const activities = [
    { name: 'All In One', type: ActivityType.Playing, status: 'Idle' },
    { name: '####', type: ActivityType.Watching, status: 'idle' },
    { name: '#####', type: ActivityType.Watching, status: 'idle' },
    { name: '/help', type: ActivityType.Listening, status: 'idle' }
];

function updateStatus() {
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setPresence({
        activities: [{ name: randomActivity.name, type: randomActivity.type }],
        status: randomActivity.status
    });
}

// Keep the ready event handler and remove any duplicate versions:
client.once('ready', async () => {
    console.log(`${client.user.tag} is ready to service!`);
    
    try {
        // Initialize the LogManager with client reference (only once)
        logManager.init(client);
        console.log('LogManager initialized with client reference');
        
        // Reset active tickets
        await ticketDB.resetActiveTickets();
        console.log('Successfully reset active tickets');

        // Validate log channels for all guilds
        console.log('Validating log configurations for all guilds...');
        for (const guild of client.guilds.cache.values()) {
            await guildConfig.loadGuildConfig(guild.id);
        }
        console.log('Log configuration validation complete');

        // Set up error handler log channels for each guild
        client.guilds.cache.forEach(async guild => {
            const config = await guildConfig.loadGuildConfig(guild.id);
            if (config.ticketSystem.channels.logs) {
                const logChannel = guild.channels.cache.get(config.ticketSystem.channels.logs);
                if (logChannel) {
                    errorHandler.setLogChannel(guild.id, logChannel);
                    
                    // Log bot restart
                    const restartEmbed = new EmbedBuilder()
                        .setColor('#2f3136')
                        .setTitle('🔄 Bot Restarted')
                        .setDescription('The bot has restarted and ticket data has been reset.')
                        .addFields([
                            { name: 'Status', value: '✅ Ready to create new tickets' }
                        ])
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [restartEmbed] });
                }
            }
        });
        
        // Set up global error handlers
        errorHandler.setupGlobalHandlers(client);
        
        // Set initial status and activity
        updateStatus();
        
        // Update status every 30 seconds
        setInterval(updateStatus, 30000);

        // Initialize console commands with client reference
        const consoleCommands = new ConsoleCommands(client);
        consoleCommands.init();
        
        console.log('📟 Terminal Control System Initialized');
    } catch (error) {
        console.error('Error during startup:', error);
    }
});

// Add guild join handler
client.on('guildCreate', async guild => {
    try {
        // Initialize default config
        await guildConfig.loadGuildConfig(guild.id);
        
        // Find suitable welcome channel
        const channel = guild.systemChannel || guild.channels.cache
            .find(ch => ch.type === ChannelType.GuildText && 
                       ch.permissionsFor(guild.members.me).has('SendMessages'));

        if (channel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('👋 Thanks for adding me!')
                .setDescription('To get started, please run `/setup` to configure the bot.')
                .addFields([
                    { 
                        name: '📝 Required Setup',
                        value: 'An administrator needs to configure:\n- Staff Roles\n- Log Channels\n- Ticket Category'
                    },
                    {
                        name: '🤔 Need Help?',
                        value: 'Use `/help` to see all available commands'
                    }
                ])
                .setTimestamp();

            await channel.send({ embeds: [welcomeEmbed] });
        }

        // Log new guild join
        console.log(`Bot joined new guild: ${guild.name} (${guild.id})`);

    } catch (error) {
        console.error('Error handling guild join:', error);
    }
});

// Add guild leave handler
client.on('guildDelete', async guild => {
    try {
        // Clean up guild configuration
        await guildConfig.removeGuildConfig(guild.id);
        console.log(`Left guild and cleaned up: ${guild.name} (${guild.id})`);
    } catch (error) {
        console.error('Error handling guild leave:', error);
    }
});

client.login(token);