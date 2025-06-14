// Fix log channels in guild configs
const fs = require('fs');
const path = require('path');

// Path to guild configs
const configPath = path.join(__dirname, '../data/guildConfigs');

// Process all guild config files
function fixGuildConfigs() {
    try {
        // Check if directory exists
        if (!fs.existsSync(configPath)) {
            console.error('Config directory not found:', configPath);
            return;
        }

        // Get all JSON files
        const files = fs.readdirSync(configPath).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} guild config files`);

        // Process each file
        let fixedCount = 0;
        for (const file of files) {
            const filePath = path.join(configPath, file);
            
            try {
                // Parse the config
                const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // Check if logChannels exists
                if (!config.logChannels) {
                    config.logChannels = {
                        roleLog: null,
                        channelLog: null,
                        messageLog: null,
                        voiceLog: null
                    };
                    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
                    console.log(`Added missing logChannels structure to ${file}`);
                    fixedCount++;
                    continue;
                }
                
                // Check if voiceLog exists
                if (!('voiceLog' in config.logChannels)) {
                    config.logChannels.voiceLog = null;
                    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
                    console.log(`Added missing voiceLog field to ${file}`);
                    fixedCount++;
                }
            } catch (err) {
                console.error(`Error processing file ${file}:`, err);
            }
        }

        console.log(`Fixed ${fixedCount} out of ${files.length} guild configs`);
    } catch (err) {
        console.error('Error fixing guild configs:', err);
    }
}

// Run the fix
fixGuildConfigs();
