// Self-monitoring system for tracking my performance and activities
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'activity-log.jsonl');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const CURRENT_TASK_FILE = path.join(DATA_DIR, 'current-task.json');

// Telegram config (from environment or config)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1414504063';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Send Telegram notification
function notify(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const cmd = `curl -s -X POST "${url}" -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=${encodeURIComponent(message)}" -d "parse_mode=Markdown"`;
    
    exec(cmd, (error) => {
        if (error) {
            console.error('Notification failed:', error.message);
        }
    });
}

class SelfMonitor {
    constructor() {
        this.sessionStart = Date.now();
        this.activities = [];
        this.currentTask = null;
    }

    // Start a new task
    startTask(type, description, project = null) {
        this.currentTask = {
            id: Date.now().toString(),
            type,
            description,
            project,
            startedAt: new Date().toISOString(),
            status: 'in_progress'
        };

        // Save current task
        fs.writeFileSync(CURRENT_TASK_FILE, JSON.stringify(this.currentTask, null, 2));

        // Notify user
        const emoji = this.getEmoji(type);
        notify(`${emoji} *Started:* ${description}${project ? ` (${project})` : ''}`);

        return this.currentTask;
    }

    // Finish current task
    finishTask(success = true, error = null) {
        if (!this.currentTask) {
            console.log('No active task to finish');
            return null;
        }

        const finishedAt = new Date();
        const startedAt = new Date(this.currentTask.startedAt);
        const duration = Math.round((finishedAt - startedAt) / 1000 / 60); // minutes

        // Update task
        this.currentTask.status = success ? 'completed' : 'failed';
        this.currentTask.finishedAt = finishedAt.toISOString();
        this.currentTask.duration = duration;
        this.currentTask.success = success;
        this.currentTask.error = error;

        // Log the activity
        this.logActivity(this.currentTask.type, this.currentTask.description, {
            project: this.currentTask.project,
            duration,
            success,
            error
        });

        // Clear current task
        fs.unlinkSync(CURRENT_TASK_FILE);

        // Notify user
        const emoji = success ? '✅' : '❌';
        const status = success ? 'Finished' : 'Failed';
        const durationStr = duration < 1 ? '<1 min' : `${duration} min`;
        notify(`${emoji} *${status}:* ${this.currentTask.description} (${durationStr})`);

        const task = this.currentTask;
        this.currentTask = null;
        return task;
    }

    // Get emoji for task type
    getEmoji(type) {
        const emojis = {
            build: '🔨',
            refactor: '🔄',
            document: '📝',
            review: '👀',
            fix: '🐛',
            test: '🧪',
            deploy: '🚀',
            research: '🔍'
        };
        return emojis[type] || '⚡';
    }

    // Log an activity
    logActivity(type, description, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            description,
            project: metadata.project || null,
            duration: metadata.duration || null,
            tokens: metadata.tokens || null,
            success: metadata.success !== false,
            error: metadata.error || null
        };

        this.activities.push(entry);
        
        // Append to JSONL file
        fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
        
        return entry;
    }

    // Get today's activities
    getTodayActivities() {
        const today = new Date().toDateString();
        return this.activities.filter(a => 
            new Date(a.timestamp).toDateString() === today
        );
    }

    // Get stats for a time period
    getStats(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        const recent = this.activities.filter(a => 
            new Date(a.timestamp).getTime() > cutoff
        );

        const stats = {
            period: `${hours}h`,
            totalActivities: recent.length,
            byType: {},
            byProject: {},
            successRate: 0,
            projectsWorked: new Set()
        };

        let successes = 0;
        for (const activity of recent) {
            // By type
            stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
            
            // By project
            if (activity.project) {
                stats.byProject[activity.project] = (stats.byProject[activity.project] || 0) + 1;
                stats.projectsWorked.add(activity.project);
            }
            
            if (activity.success) successes++;
        }

        stats.successRate = recent.length > 0 
            ? Math.round((successes / recent.length) * 100) 
            : 100;
        
        stats.projectsWorked = Array.from(stats.projectsWorked);

        return stats;
    }

    // Get current status for dashboard
    getDashboardData() {
        const today = this.getTodayActivities();
        const last24h = this.getStats(24);
        const last7d = this.getStats(168); // 7 days

        // Current activity (most recent)
        const current = today[today.length - 1] || null;

        // Recent projects (last 5 unique)
        const recentProjects = [...new Set(
            today.filter(a => a.project).map(a => a.project)
        )].slice(-5);

        return {
            current: current ? {
                type: current.type,
                description: current.description,
                project: current.project,
                started: current.timestamp
            } : null,
            today: {
                count: today.length,
                types: last24h.byType,
                projects: recentProjects
            },
            stats24h: last24h,
            stats7d: last7d,
            lastUpdated: new Date().toISOString()
        };
    }

    // Save current state
    saveStats() {
        const stats = this.getDashboardData();
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
        return stats;
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new SelfMonitor();
    const command = process.argv[2];

    switch (command) {
        case 'start':
            const startType = process.argv[3];
            const startDesc = process.argv[4];
            const startProject = process.argv[5];
            if (!startType || !startDesc) {
                console.log('Usage: node self-monitor.js start <type> <description> [project]');
                console.log('Types: build, refactor, document, review, fix, test, deploy, research');
                process.exit(1);
            }
            monitor.startTask(startType, startDesc, startProject);
            console.log(`✓ Started: ${startDesc}`);
            break;

        case 'finish':
            const success = process.argv[3] !== 'fail';
            const error = process.argv[4] || null;
            const finished = monitor.finishTask(success, error);
            if (finished) {
                console.log(`✓ ${success ? 'Finished' : 'Failed'}: ${finished.description}`);
            }
            break;

        case 'current':
            if (monitor.currentTask) {
                console.log('Current task:', monitor.currentTask);
            } else if (fs.existsSync(CURRENT_TASK_FILE)) {
                const current = JSON.parse(fs.readFileSync(CURRENT_TASK_FILE));
                console.log('Current task:', current);
            } else {
                console.log('No active task');
            }
            break;

        case 'log':
            const type = process.argv[3];
            const desc = process.argv[4];
            const project = process.argv[5];
            if (!type || !desc) {
                console.log('Usage: node self-monitor.js log <type> <description> [project]');
                process.exit(1);
            }
            monitor.logActivity(type, desc, { project });
            console.log('✓ Activity logged');
            break;

        case 'status':
            console.log(JSON.stringify(monitor.getDashboardData(), null, 2));
            break;

        case 'stats':
            const hours = parseInt(process.argv[3]) || 24;
            console.log(JSON.stringify(monitor.getStats(hours), null, 2));
            break;

        case 'today':
            const today = monitor.getTodayActivities();
            console.log(`Today's activities (${today.length}):`);
            today.forEach(a => {
                console.log(`  [${a.type}] ${a.description} ${a.project ? `(${a.project})` : ''}`);
            });
            break;

        default:
            console.log('Self-Monitor Commands:');
            console.log('  start <type> <desc> [project]  - Start a task (notifies user)');
            console.log('  finish [fail] [error]          - Finish current task (notifies user)');
            console.log('  current                        - Show current task');
            console.log('  log <type> <desc> [project]    - Log an activity');
            console.log('  status                         - Get dashboard data');
            console.log('  stats [hours]                  - Get stats for period');
            console.log('  today                          - List today\'s activities');
    }
}

module.exports = SelfMonitor;
