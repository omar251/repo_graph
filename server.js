const express = require('express');
const path = require('path');
const { main } = require('./analyze_dependencies.js');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/analyze', async (req, res) => {
    try {
        const { repoPath } = req.body;
        if (!repoPath) {
            return res.status(400).json({ error: 'Repository path is required' });
        }

        const { spawn } = require('child_process');
        
        const child = spawn('node', ['analyze_dependencies.js', repoPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        child.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: error || 'Analysis failed' });
            }
            
            try {
                const fs = require('fs');
                const networkData = JSON.parse(fs.readFileSync('network-data.json', 'utf8'));
                res.json(networkData);
            } catch (parseError) {
                res.status(500).json({ error: 'Failed to read analysis results' });
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});