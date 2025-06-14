const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Display detailed server information'),

    async execute(interaction) {
        try {
            // Defer reply immediately to prevent timeout
            await interaction.deferReply();

            const guild = interaction.guild;
            await guild.members.fetch(); // Force fetch all members
            
            // Calculate server age
            const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);
            const serverAge = `<t:${createdTimestamp}:R>`;

            // Get member counts with presence data
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(member => 
                member.presence && ['online', 'idle', 'dnd'].includes(member.presence.status)
            ).size;
            const offlineMembers = totalMembers - onlineMembers;

            // Get channel counts
            const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2).size;

            // Create embed
            const serverEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
                .addFields(
                    { name: '📆 Server Created', value: serverAge, inline: true },
                    { name: '👑 Server Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { 
                        name: '📊 Member Count', 
                        value: `Total: ${totalMembers}\n🟢 Online: ${onlineMembers}\n⚫ Offline: ${offlineMembers}`, 
                        inline: false 
                    },
                    { 
                        name: '💬 Channels', 
                        value: `Text: ${textChannels}\nVoice: ${voiceChannels}\nTotal: ${guild.channels.cache.size}`, 
                        inline: true 
                    },
                    { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true }
                )
                .setFooter({ 
                    text: `Server ID: ${guild.id}`,
                    iconURL: guild.iconURL({ dynamic: true })
                });

            if (guild.bannerURL()) {
                serverEmbed.setImage(guild.bannerURL({ size: 1024 }));
            }

            // Edit the deferred reply
            await interaction.editReply({ embeds: [serverEmbed] });
            
        } catch (error) {
            console.error('Server command error:', error);
            
            // Handle the error response
            if (interaction.deferred) {
                await interaction.editReply({ 
                    content: 'There was an error getting server information.',
                    ephemeral: true 
                }).catch(console.error);
            } else {
                await interaction.reply({ 
                    content: 'There was an error getting server information.',
                    ephemeral: true 
                }).catch(console.error);
            }
        }
    },
};