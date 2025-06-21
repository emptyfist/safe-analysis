import { promises as fs } from 'fs';
import * as path from 'path';
import { AnalyzeSafe } from './analyze-safe'; 
import { DuneAnalytics } from './dune-query';
import config from './config';

type CommandLineArgs = {
  help?: boolean;
}

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

  async runAnalysis(): Promise<void> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    console.log('🔍 Starting Safe Wallet Protocol Analysis...');
    console.log(`📅 Analyzing last ${config.defaultDays} days`);
    console.log(`🔢 Top ${config.defaultTopCount} protocols`);
    console.log('─'.repeat(50));

    try {
      if (config.analyzeWithLabel) {
        console.log('📊 Loading contract labels...');
        await this.analyze.loadDictionary();
      }

      console.log('📊 Fetching statistical(non multi-send Safe wallet transactions) data...');
      const statistics = await this.duneAnalytics.getStatistics(config.duneQueryIdForStatistics);
      console.log(`✅ Found ${statistics.length.toLocaleString()} statistical data`);

      console.log('📊 Fetching multi-send Safe wallet transactions...');
      const interactAddresses = await this.duneAnalytics.getSafeTransactions(config.duneQueryIdForTransactions);
      console.log(`✅ Found ${interactAddresses.length.toLocaleString()} interacted addresses \n`);

      await this.analyze.handle(statistics, interactAddresses);
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
    console.log('  --help   Show this help message');
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
  if (options?.help) {
    app.printUsage();
    return;
  }
  try {
    await app.init();
    await app.runAnalysis();
  } catch (error) {
    const err = error as Error;
    console.error('💥 Application failed:', err.message);
    process.exit(1);
  }
}

// Error handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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