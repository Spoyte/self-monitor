#!/usr/bin/env node
// Autonomous agent loop - continuously works on tasks without waiting for cron

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'agent-state.json');
const BACKLOG_FILE = path.join(DATA_DIR, 'backlog.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default backlog
const DEFAULT_BACKLOG = [
    { id: 1, task: "Build README generator for projects", type: "tool", priority: "high" },
    { id: 2, task: "Create automated test suite", type: "test", priority: "high" },
    { id: 3, task: "Build git automation tool (PRs, branches)", type: "tool", priority: "medium" },
    { id: 4, task: "Document architecture decisions", type: "docs", priority: "medium" },
    { id: 5, task: "Refactor remaining early projects", type: "refactor", priority: "medium" },
    { id: 6, task: "Build project dependency visualizer", type: "tool", priority: "low" },
    { id: 7, task: "Create performance benchmarking tool", type: "tool", priority: "low" },
    { id: 8, task: "Build code quality checker", type: "tool", priority: "low" }
];

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    return {
        currentTask: null,
        completedTasks: [],
        lastActivity: null,
        mode: 'idle' // idle, working, paused
    };
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadBacklog() {
    if (fs.existsSync(BACKLOG_FILE)) {
        return JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8'));
    }
    return DEFAULT_BACKLOG;
}

function saveBacklog(backlog) {
    fs.writeFileSync(BACKLOG_FILE, JSON.stringify(backlog, null, 2));
}

function notify(message) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1414504063';
    
    try {
        execSync(`curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=${encodeURIComponent(message)}" -d "parse_mode=Markdown"`, { timeout: 5000 });
    } catch (e) {
        console.log('Notification failed:', e.message);
    }
}

function getNextTask(backlog) {
    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...backlog].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return sorted[0] || null;
}

function startTask(task) {
    const state = loadState();
    state.currentTask = {
        ...task,
        startedAt: new Date().toISOString()
    };
    state.mode = 'working';
    saveState(state);
    
    const emoji = { build: '🔨', test: '🧪', docs: '📝', refactor: '🔄', tool: '⚡' }[task.type] || '⚡';
    notify(`${emoji} Started: ${task.task}`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TASK: ${task.task}`);
    console.log(`Type: ${task.type} | Priority: ${task.priority}`);
    console.log(`${'='.repeat(60)}\n`);
}

function completeTask(success = true, result = '') {
    const state = loadState();
    if (!state.currentTask) return;
    
    const task = state.currentTask;
    const finishedAt = new Date();
    const startedAt = new Date(task.startedAt);
    const duration = Math.round((finishedAt - startedAt) / 1000 / 60);
    
    task.finishedAt = finishedAt.toISOString();
    task.duration = duration;
    task.success = success;
    task.result = result;
    
    state.completedTasks.push(task);
    state.currentTask = null;
    state.mode = 'idle';
    state.lastActivity = finishedAt.toISOString();
    saveState(state);
    
    // Remove from backlog
    const backlog = loadBacklog();
    const updatedBacklog = backlog.filter(t => t.id !== task.id);
    saveBacklog(updatedBacklog);
    
    const emoji = success ? '✅' : '❌';
    const status = success ? 'Finished' : 'Failed';
    notify(`${emoji} ${status}: ${task.task} (${duration} min)`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${status}: ${task.task}`);
    console.log(`Duration: ${duration} minutes`);
    console.log(`${'='.repeat(60)}\n`);
}

function shouldContinue() {
    const state = loadState();
    
    // Check if manually paused
    if (state.mode === 'paused') {
        console.log('Agent is paused. Set mode to "idle" to resume.');
        return false;
    }
    
    // Check if there's a current task (shouldn't happen, but safety check)
    if (state.currentTask) {
        console.log('Warning: Current task exists but we are in main loop. Completing it.');
        completeTask(false, 'Orphaned task - agent restarted');
    }
    
    return true;
}

function work() {
    if (!shouldContinue()) {
        console.log('Agent stopped. Run again to resume.');
        process.exit(0);
    }
    
    const backlog = loadBacklog();
    
    if (backlog.length === 0) {
        console.log('No tasks in backlog. Add tasks to continue.');
        notify('📭 Backlog empty - waiting for new tasks');
        process.exit(0);
    }
    
    const task = getNextTask(backlog);
    startTask(task);
    
    // Here the actual work would happen
    // For now, we'll just simulate and spawn the work
    console.log('Spawning sub-agent to complete task...');
    
    // In real implementation, this would spawn a sub-agent session
    // For now, we mark it as needing manual work
    console.log(`\nTask "${task.task}" is ready to be worked on.`);
    console.log('In full autonomous mode, I would now:');
    console.log('1. Spawn a sub-agent with this task');
    console.log('2. Work on it until completion');
    console.log('3. Mark complete and continue to next task');
    console.log('\nTo enable full autonomy, this script needs to integrate with OpenClaw sessions.');
    
    // For now, just mark as "in progress" and exit
    // The cron will pick up that we're working and not start new tasks
    console.log('\nTask marked as in-progress. Complete it manually or via sub-agent.');
}

// Main
console.log('🐙 Nemo Autonomous Agent');
console.log('Mode: Continuous self-improvement\n');

const command = process.argv[2];

if (command === 'status') {
    const state = loadState();
    const backlog = loadBacklog();
    console.log('Current State:', state.mode);
    console.log('Current Task:', state.currentTask?.task || 'None');
    console.log('Completed Tasks:', state.completedTasks.length);
    console.log('Backlog Size:', backlog.length);
    console.log('\nNext 3 Tasks:');
    backlog.slice(0, 3).forEach((t, i) => console.log(`  ${i+1}. [${t.priority}] ${t.task}`));
} else if (command === 'pause') {
    const state = loadState();
    state.mode = 'paused';
    saveState(state);
    console.log('Agent paused.');
} else if (command === 'resume') {
    const state = loadState();
    state.mode = 'idle';
    saveState(state);
    console.log('Agent resumed.');
} else if (command === 'complete') {
    completeTask(true, process.argv[3] || 'Completed successfully');
    console.log('Task marked complete. Run again to start next task.');
} else if (command === 'fail') {
    completeTask(false, process.argv[3] || 'Failed');
    console.log('Task marked failed. Run again to start next task.');
} else if (command === 'add') {
    const taskText = process.argv.slice(3).join(' ');
    if (!taskText) {
        console.log('Usage: node autonomous-agent.js add <task description>');
        process.exit(1);
    }
    const backlog = loadBacklog();
    const newTask = {
        id: Date.now(),
        task: taskText,
        type: 'build',
        priority: 'medium'
    };
    backlog.push(newTask);
    saveBacklog(backlog);
    console.log(`Added task: ${taskText}`);
} else {
    work();
}
