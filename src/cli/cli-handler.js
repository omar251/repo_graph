/**
 * Command Line Interface Handler
 * Parses arguments and provides help functionality
 */

class CLIHandler {
    constructor() {
        this.options = {
            help: { alias: 'h', description: 'Show this help message' },
            output: { alias: 'o', description: 'Output file path', default: 'network-data.json' },
            format: { alias: 'f', description: 'Output format: json, js', default: 'json' },
            includeExternal: { description: 'Include external dependencies (npm, pip packages)' },
            verbose: { alias: 'v', description: 'Verbose output' },
            quiet: { alias: 'q', description: 'Suppress output messages' },
            excludePatterns: { description: 'Comma-separated exclude patterns' },
            maxFileSize: { description: 'Maximum file size to process (bytes)', default: 1048576 },
            cache: { description: 'Enable caching', default: true },
            config: { alias: 'c', description: 'Path to configuration file' }
        };
    }

    parse(argv) {
        const args = argv.slice(2);
        const parsed = {
            repositoryPath: null,
            help: false,
            verbose: false,
            quiet: false,
            includeExternal: false,
            cache: true,
            output: 'network-data.json',
            format: 'json',
            maxFileSize: 1048576,
            excludePatterns: []
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];

            if (arg === '--help' || arg === '-h') {
                parsed.help = true;
            } else if (arg === '--verbose' || arg === '-v') {
                parsed.verbose = true;
            } else if (arg === '--quiet' || arg === '-q') {
                parsed.quiet = true;
            } else if (arg === '--include-external') {
                parsed.includeExternal = true;
            } else if (arg === '--no-cache') {
                parsed.cache = false;
            } else if ((arg === '--output' || arg === '-o') && nextArg) {
                parsed.output = nextArg;
                i++;
            } else if ((arg === '--format' || arg === '-f') && nextArg) {
                parsed.format = nextArg;
                i++;
            } else if ((arg === '--config' || arg === '-c') && nextArg) {
                parsed.config = nextArg;
                i++;
            } else if (arg === '--exclude-patterns' && nextArg) {
                parsed.excludePatterns = nextArg.split(',').map(p => p.trim());
                i++;
            } else if (arg === '--max-file-size' && nextArg) {
                parsed.maxFileSize = parseInt(nextArg);
                i++;
            } else if (!arg.startsWith('-')) {
                if (!parsed.repositoryPath) {
                    parsed.repositoryPath = arg;
                }
            }
        }

        return parsed;
    }

    showHelp() {
        console.log(`
Repository Dependency Graph Analyzer v2.0.0

Usage: node src/index.js [options] <repository_path>

Arguments:
  repository_path              Path to the repository to analyze

Options:
  -h, --help                  Show this help message
  -o, --output <file>         Output file path (default: network-data.json)
  -f, --format <format>       Output format: json, js (default: json)
  -c, --config <file>         Path to configuration file
  --include-external          Include external dependencies (npm, pip packages)
  --exclude-patterns <list>   Comma-separated exclude patterns
  --max-file-size <bytes>     Maximum file size to process (default: 1MB)
  -v, --verbose               Verbose output
  -q, --quiet                 Suppress output messages
  --no-cache                  Disable caching

Examples:
  node src/index.js /path/to/repo
  node src/index.js -o graph.json -f json /path/to/repo
  node src/index.js --verbose --include-external /path/to/repo
  node src/index.js --exclude-patterns "node_modules/**,dist/**" /path/to/repo

Supported file types: .js, .jsx, .ts, .tsx, .py

For more information, visit: https://github.com/your-repo/dependency-graph
        `);
    }

    validateArgs(parsed) {
        const errors = [];

        if (!parsed.repositoryPath && !parsed.help) {
            errors.push('Repository path is required');
        }

        if (parsed.format && !['json', 'js'].includes(parsed.format)) {
            errors.push('Format must be "json" or "js"');
        }

        if (parsed.maxFileSize && (parsed.maxFileSize < 1 || parsed.maxFileSize > 100 * 1024 * 1024)) {
            errors.push('Max file size must be between 1 byte and 100MB');
        }

        return errors;
    }
}

module.exports = { CLIHandler };