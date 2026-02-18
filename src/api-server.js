// API server for dashboard - serves real data from self-monitor and system
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const PORT = process.env.DASHBOARD_PORT || 3456;
const DATA_DIR = path.join(__dirname, '..', 'data'); // Use same dir as self-monitor.js
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const CURRENT_TASK_FILE = path.join(DATA_DIR, 'current-task.json');
const ACTIVITY_LOG = path.join(DATA_DIR, 'activity-log.jsonl');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

// Get system stats
async function getSystemStats() {
    try {
        // Get uptime
        const { stdout: uptime } = await execAsync('uptime -p 2>/dev/null || uptime');
        
        // Get load average
        const { stdout: loadavg } = await execAsync('cat /proc/loadavg');
        const load = loadavg.split(' ')[0];
        
        // Get memory info
        const { stdout: meminfo } = await execAsync('free -m | grep Mem');
        const memParts = meminfo.trim().split(/\s+/);
        const totalMem = parseInt(memParts[1]);
        const usedMem = parseInt(memParts[2]);
        const memPercent = Math.round((usedMem / totalMem) * 100);
        
        // Get disk usage
        const { stdout: diskinfo } = await execAsync('df -h / | tail -1');
        const diskParts = diskinfo.trim().split(/\s+/);
        const diskPercent = parseInt(diskParts[4].replace('%', ''));
        
        return {
            uptime: uptime.trim().replace('up ', ''),
            load: load,
            memory: {
                percent: memPercent,
                used: usedMem,
                total: totalMem
            },
            disk: {
                percent: diskPercent,
                used: diskParts[2],
                total: diskParts[1]
            }
        };
    } catch (error) {
        console.error('System stats error:', error.message);
        return {
            uptime: 'unknown',
            load: '0.00',
            memory: { percent: 0, used: 0, total: 0 },
            disk: { percent: 0, used: '0G', total: '0G' }
        };
    }
}

// Get activity data from self-monitor
function getActivityData() {
    const data = {
        current: null,
        today: { count: 0, projects: [] },
        stats24h: { successRate: 100, projectsWorked: [] },
        lastUpdated: new Date().toISOString()
    };

    // Get current task
    if (fs.existsSync(CURRENT_TASK_FILE)) {
        try {
            const current = JSON.parse(fs.readFileSync(CURRENT_TASK_FILE, 'utf8'));
            data.current = {
                type: current.type,
                description: current.description,
                project: current.project,
                started: current.startedAt
            };
        } catch (e) {
            console.error('Error reading current task:', e.message);
        }
    }

    // Get activity log
    if (fs.existsSync(ACTIVITY_LOG)) {
        try {
            const lines = fs.readFileSync(ACTIVITY_LOG, 'utf8').trim().split('\n').filter(Boolean);
            const activities = lines.map(line => JSON.parse(line));
            
            const now = new Date();
            const today = new Date(now.toDateString());
            const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            // Today's activities
            const todayActivities = activities.filter(a => new Date(a.timestamp) >= today);
            data.today.count = todayActivities.length;
            
            // Recent projects (today)
            const todayProjects = [...new Set(todayActivities.filter(a => a.project).map(a => a.project))];
            data.today.projects = todayProjects.slice(-5);
            
            // Last 24h stats
            const recentActivities = activities.filter(a => new Date(a.timestamp) >= last24h);
            const successes = recentActivities.filter(a => a.success !== false).length;
            data.stats24h.successRate = recentActivities.length > 0 
                ? Math.round((successes / recentActivities.length) * 100) 
                : 100;
            
            const recentProjects = [...new Set(recentActivities.filter(a => a.project).map(a => a.project))];
            data.stats24h.projectsWorked = recentProjects;
            
        } catch (e) {
            console.error('Error reading activity log:', e.message);
        }
    }

    return data;
}

// Get all dashboard data
async function getDashboardData() {
    const [system, activity] = await Promise.all([
        getSystemStats(),
        Promise.resolve(getActivityData())
    ]);
    
    return {
        system,
        activity,
        timestamp: new Date().toISOString()
    };
}

// Serve static files
function serveStaticFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, corsHeaders);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
        res.end(data);
    });
}

// HTTP server
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // API routes
    if (pathname === '/api/dashboard') {
        const data = await getDashboardData();
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
    }

    if (pathname === '/api/system') {
        const data = await getSystemStats();
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
    }

    if (pathname === '/api/activity') {
        const data = getActivityData();
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
    }

    // Static files
    const staticDir = path.join(__dirname, '..', 'dashboard-web');
    
    if (pathname === '/' || pathname === '/index.html') {
        serveStaticFile(res, path.join(staticDir, 'index.html'), 'text/html');
        return;
    }
    
    if (pathname === '/app.js') {
        serveStaticFile(res, path.join(staticDir, 'app.js'), 'application/javascript');
        return;
    }
    
    if (pathname === '/style.css') {
        serveStaticFile(res, path.join(staticDir, 'style.css'), 'text/css');
        return;
    }

    // 404
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`Dashboard API server running on http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  GET /api/dashboard - Full dashboard data`);
    console.log(`  GET /api/system    - System stats only`);
    console.log(`  GET /api/activity  - Activity data only`);
});

module.exports = { getDashboardData, getSystemStats, getActivityData };
