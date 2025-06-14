const fs = require('fs');
const path = require('path');

class TicketDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/tickets');
        this.ensureDatabase();
        this.cache = new Map();
    }

    ensureDatabase() {
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
    }

    getGuildDbPath(guildId) {
        return path.join(this.dbPath, `${guildId}.json`);
    }

    async initGuildDb(guildId) {
        const dbFile = this.getGuildDbPath(guildId);
        if (!fs.existsSync(dbFile)) {
            fs.writeFileSync(dbFile, JSON.stringify({
                tickets: [],
                metadata: {
                    totalTickets: 0,
                    activeTickets: 0,
                    lastTicketId: 0
                }
            }, null, 2));
        }
    }

    async createTicket(ticketData) {
        try {
            const { guildId } = ticketData;
            await this.initGuildDb(guildId);
            
            const dbFile = this.getGuildDbPath(guildId);
            const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            
            // Update metadata
            data.metadata.totalTickets++;
            data.metadata.activeTickets++;
            data.metadata.lastTicketId++;

            // Create ticket entry
            const ticket = {
                ...ticketData,
                ticketNumber: data.metadata.lastTicketId,
                createdAt: new Date().toISOString(),
                status: 'open',
                claimed: null,
                claimedBy: null,
                claimedAt: null,
                closedAt: null,
                transcriptUrl: null
            };

            data.tickets.push(ticket);
            fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
            
            return ticket;
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }
    }

    async getTicket(ticketId, guildId) {
        try {
            const dbFile = this.getGuildDbPath(guildId);
            if (!fs.existsSync(dbFile)) return null;

            const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            return data.tickets.find(t => t.ticketId === ticketId);
        } catch (error) {
            console.error('Error getting ticket:', error);
            return null;
        }
    }

    async updateTicket(ticketId, guildId, updates) {
        try {
            const dbFile = this.getGuildDbPath(guildId);
            if (!fs.existsSync(dbFile)) return false;

            const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            const ticketIndex = data.tickets.findIndex(t => t.ticketId === ticketId);
            
            if (ticketIndex === -1) return false;

            // Update metadata if status changes
            if (updates.status === 'closed' && data.tickets[ticketIndex].status === 'open') {
                data.metadata.activeTickets--;
            }

            data.tickets[ticketIndex] = {
                ...data.tickets[ticketIndex],
                ...updates,
                lastUpdated: new Date().toISOString()
            };

            fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error updating ticket:', error);
            return false;
        }
    }

    async getUserOpenTickets(userId, guildId) {
        try {
            const dbFile = this.getGuildDbPath(guildId);
            if (!fs.existsSync(dbFile)) return 0;

            const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            return data.tickets.filter(t => 
                t.userId === userId && 
                t.status === 'open'
            ).length;
        } catch (error) {
            console.error('Error getting user tickets:', error);
            return 0;
        }
    }

    async getGuildStats(guildId) {
        try {
            const dbFile = this.getGuildDbPath(guildId);
            if (!fs.existsSync(dbFile)) {
                await this.initGuildDb(guildId);
                return {
                    totalTickets: 0,
                    activeTickets: 0,
                    lastTicketId: 0
                };
            }

            const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            return data.metadata;
        } catch (error) {
            console.error('Error getting guild stats:', error);
            return null;
        }
    }

    async resetActiveTickets() {
        try {
            // Get all guild database files
            const files = fs.readdirSync(this.dbPath)
                .filter(file => file.endsWith('.json'));

            for (const file of files) {
                const guildId = file.replace('.json', '');
                const dbFile = this.getGuildDbPath(guildId);
                
                if (fs.existsSync(dbFile)) {
                    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
                    
                    // Reset active tickets count
                    data.metadata.activeTickets = 0;
                    
                    // Mark all 'open' tickets as 'force_closed'
                    data.tickets = data.tickets.map(ticket => {
                        if (ticket.status === 'open') {
                            return {
                                ...ticket,
                                status: 'force_closed',
                                closedAt: new Date().toISOString(),
                                closeReason: 'Bot restart'
                            };
                        }
                        return ticket;
                    });

                    // Save updated data
                    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
                }
            }
            
            // Clear cache
            this.cache.clear();
            return true;
        } catch (error) {
            console.error('Error resetting active tickets:', error);
            return false;
        }
    }
}

module.exports = new TicketDatabase();