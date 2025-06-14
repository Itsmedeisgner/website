const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');
const fs = require('fs');
const path = require('path');

const commands = [];
// Remove MusicBot from command folders
const commandFolders = ['TicketBot/commands', 'SystemBot/commands'];

// Load commands from all command folders
for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, folder);
    
    // Check if directory exists
    if (fs.existsSync(folderPath)) {
        const commandFiles = fs.readdirSync(folderPath)
            .filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(folderPath, file));
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`Loaded command: ${command.data.name} from ${folder}/${file}`);
            }
        }
    } else {
        console.warn(`Warning: Directory ${folder} not found`);
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands globally...`);

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );

        console.log('Successfully registered commands globally.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();