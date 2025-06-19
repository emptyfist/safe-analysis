import { promises as fs } from 'fs';
import * as path from 'path';
import { AnalyzeSafe } from './analyze-safe';
import { DuneAnalytics } from './dune-query';
import config from './config';
import { 
  AnalysisOptions, 
  CommandLineArgs,
} from './types';

export class SafeAnalysisApp {
  private readonly analyze: AnalyzeSafe;
  private readonly duneAnalytics: DuneAnalytics;
  private readonly outputDir: string;

  constructor() {
    this.outputDir = path.join(__dirname, '..', config.outputDir);
    this.analyze = new AnalyzeSafe(this.outputDir);
    this.duneAnalytics = new DuneAnalytics();
  }

  async init(): Promise<void> {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`Created output directory: ${this.outputDir}`);
    }
  }

  async runAnalysis(options: AnalysisOptions): Promise<void> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    const { days, topCount } = options;

    // Input validation
    if (days <= 0 || days > 365) {
      throw new Error('Days must be between 1 and 365');
    }

    if (topCount <= 0 || topCount > 10000) {
      throw new Error('Top count must be between 1 and 10000');
    }

    console.log('🔍 Starting Safe Wallet Protocol Analysis...');
    console.log(`📅 Analyzing last ${days} days`);
    console.log(`🔢 Top ${topCount} protocols`);
    console.log('─'.repeat(50));

    try {
      if (config.analyzeWithLabel) {
        console.log('📊 Loading contract labels...');
        await this.analyze.loadDictionary();
      }

      console.log('📊 Fetching Safe wallet interaction data...');
      const data = await this.duneAnalytics.getSafeTransactions(config.duneTransaction);
      
      if (!data || data.length === 0) {
        console.log('⚠️  No transaction data found for the specified period');
        return;
      }
      
      console.log(`✅ Found ${data.length.toLocaleString()} transactions with Safe wallet interactions \n`);

      await this.analyze.handle(data, options);
      
      // Performance metrics
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const processingTime = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
      
      console.log('\n🎉 Analysis completed successfully!');
      console.log(`⏱️  Processing time: ${processingTime}ms`);
      console.log(`💾 Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
      const err = error as Error;
      console.error('❌ Analysis failed:', err.message);
      
      if (err.message.includes('API key')) {
        console.log('\n💡 Make sure to set your DUNE_API_KEY in your environment variables or config file');
      }
      
      process.exit(1);
    }
  }

  printUsage(): void {
    console.log('🛠️  SAFE WALLET ANALYSIS TOOL');
    console.log('═'.repeat(50));
    console.log('Usage: npm start [options]');
    console.log('');
    console.log('Options:');
    console.log('  --days <number>      Days to analyze (default: 30)');
    console.log('  --top <number>       Top N protocols (default: 100)');
    console.log('  --help              Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  npm start                    # Default analysis');
    console.log('  npm start -- --days 7       # Analyze last 7 days');
  }
}

// Command line argument parsing
function parseCommandLineArgs(args: string[]): CommandLineArgs {
  const options: CommandLineArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (!arg) continue;
    
    switch (arg) {
      case '--help':
        options.help = true;
        break;
      case '--days':
        if (i + 1 >= args.length) {
          throw new Error('--days requires a value');
        }
        const days = parseInt(args[++i] as string);
        if (isNaN(days) || days <= 0) {
          throw new Error('--days must be a positive number');
        }
        options.days = days;
        break;
      case '--top':
        if (i + 1 >= args.length) {
          throw new Error('--top requires a value');
        }
        const topCount = parseInt(args[++i] as string);
        if (isNaN(topCount) || topCount <= 0) {
          throw new Error('--top must be a positive number');
        }
        options.topCount = topCount;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        break;
    }
  }
  
  return options;
}

// Main execution function
async function main(): Promise<void> {
  const app = new SafeAnalysisApp();
  const args = process.argv.slice(2);
  const options = parseCommandLineArgs(args);
  
  if (options.help) {
    app.printUsage();
    return;
  }
  
  try {
    await app.init();
    await app.runAnalysis({
      days: options.days ?? config.defaultDays,
      topCount: options.topCount ??  config.defaultTopCount
    });
  } catch (error) {
    const err = error as Error;
    console.error('💥 Application failed:', err.message);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default SafeAnalysisApp;