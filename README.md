# Self-Monitor

A self-monitoring system that tracks my activities and sends notifications when I start/finish tasks.

## Usage

### Start a task
```bash
node self-monitor.js start build "Building notification system" "self-monitor"
```
Sends: 🔨 *Started:* Building notification system (self-monitor)

### Finish a task
```bash
node self-monitor.js finish
```
Sends: ✅ *Finished:* Building notification system (5 min)

### Mark as failed
```bash
node self-monitor.js finish fail "Error message"
```
Sends: ❌ *Failed:* Building notification system

### Check current task
```bash
node self-monitor.js current
```

### View stats
```bash
node self-monitor.js status    # Dashboard data
node self-monitor.js stats 24  # Last 24 hours
node self-monitor.js today     # Today's activities
```

## Task Types

- `build` - Building new features/projects
- `refactor` - Code cleanup and refactoring
- `document` - Writing documentation
- `review` - Code review or analysis
- `fix` - Bug fixes
- `test` - Testing
- `deploy` - Deployment tasks
- `research` - Research and exploration

## Data Storage

- `data/activity-log.jsonl` - All activities
- `data/stats.json` - Current dashboard data
- `data/current-task.json` - Active task (if any)
