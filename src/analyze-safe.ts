import { promises as fs } from 'fs';
import * as path from 'path';
import config from './config';
import { DuneAnalytics } from './dune-query';
import type { AnalysisOptions, ParsedTransaction } from './types';

interface ProtocolAnalysis {
  interactions: number;
  gas: number;
  name: string;
}

interface AnalysisMetadata {
  generated_at: string;
  analysis_period_days: number;
  top_count: number;
}

interface ProtocolResult {
  address: string;
  interactions: number;
  name: string;
}

interface ExportData {
  metadata: AnalysisMetadata;
  protocols: ProtocolResult[];
}

export class AnalyzeSafe {
  private readonly duneQuery: DuneAnalytics;
  private outputDir: string;
  private dictionary: Record<string, string>;

  constructor(outputDir: string) {
    this.duneQuery = new DuneAnalytics();
    this.dictionary = {};
    this.outputDir = outputDir;
  }

  async loadDictionary(): Promise<void> {
    const filepath = path.join(this.outputDir, 'dictionary.json');

    try {
      // Check if file exists
      await fs.access(filepath);
      
      // File exists - load data from file
      console.log(`Loading dictionary from cache...`);
      
      const fileContent = await fs.readFile(filepath, 'utf-8');
      this.dictionary = JSON.parse(fileContent);
      
      console.log(`Loaded ${Object.keys(this.dictionary).length} entries from dictionary`);
    } catch (error) {
      // File doesn't exist - get data from Dune API
      console.log(`Dictionary not found, fetching from Dune API...`);

      this.dictionary = await this.duneQuery.getContractNames(config.duneLabels);

      // Save to file
      await this.saveDictionaryToFile(filepath);
      
      console.log(`Fetched and saved ${Object.keys(this.dictionary).length} entries`);
    }
  }

  /**
   * Helper method to save dictionary to file as JSON
   */
  private async saveDictionaryToFile(filePath: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Save to file with pretty formatting
      await fs.writeFile(filePath, JSON.stringify(this.dictionary, null, 2), 'utf-8');
      
      console.log(`Dictionary saved to ${filePath}`);
    } catch (error) {
      console.error(`Error saving dictionary to file: ${error}`);
      throw error;
    }
  }

  async handle(
    data: ParsedTransaction[], 
    options: AnalysisOptions, 
  ): Promise<Record<string, ProtocolAnalysis>> {
    const { days, topCount } = options;

    // Input validation
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('No transaction data provided for analysis');
      return {};
    }

    if (topCount <= 0) {
      throw new Error('topCount must be greater than 0');
    }

    // Pre-allocate result object for better performance
    const result: Record<string, ProtocolAnalysis> = {};
    const dictionary = this.dictionary;

    // Process transactions in a single pass
    for (const { to, gas } of data) {
      const normalizedTo = to.toLowerCase();
      const existing = result[normalizedTo];
      
      if (existing) {
        existing.interactions++;
        existing.gas += Number(gas);
      } else {
        result[normalizedTo] = {
          interactions: 1,
          gas: Number(gas),
          name: config.analyzeWithLabel ? (dictionary[normalizedTo] ?? '') : ''
        };
      }
    }

    // Sort & Limit with interaction count
    const topProtocols = Object.entries(result)
      .sort((a, b) => b[1].interactions - a[1].interactions)
      .slice(0, topCount);

    await this.exportResults(topProtocols, { days, topCount });
    this.generateSummary(topProtocols);

    return result;
  }

  private async exportResults(
    data: [string, ProtocolAnalysis][], 
    metadata: { days: number; topCount: number }
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `safe-analysis-${timestamp}`;

    try {
      await this.exportAsJson(data, filename, metadata);
    } catch (error) {
      const err = error as Error;
      console.error('❌ Export failed:', err.message);
    }
  }

  private async exportAsJson(
    data: [string, ProtocolAnalysis][], 
    filename: string, 
    metadata: { days: number; topCount: number }
  ): Promise<void> {
    const output: ExportData = {
      metadata: {
        generated_at: new Date().toISOString(),
        analysis_period_days: metadata.days,
        top_count: metadata.topCount,
      },
      protocols: data.map(protocol => ({
        address: protocol[0],
        interactions: protocol[1].interactions,
        name: protocol[1].name
      }))
    };

    const filepath = path.join(this.outputDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`📄 Results exported to: ${filepath}`);
  }

  private generateSummary(data: [string, ProtocolAnalysis][]): void {
    if (data.length === 0) {
      console.log('\n📈 No protocols found for analysis');
      return;
    }

    // Use reduce for better performance
    const totals = data.reduce((acc, [, protocol]) => {
      acc.transactions += protocol.interactions;
      acc.gas += protocol.gas;
      return acc;
    }, { transactions: 0, gas: 0 });

    console.log('\n📈 TOP PROTOCOLS ANALYSIS SUMMARY');
    console.log('═'.repeat(50));
    console.log(`📊 Total Transactions: ${totals.transactions.toLocaleString()}`);
    console.log(`⛽ Total Gas Used (Wei): ${totals.gas.toLocaleString()}`);
    console.log(`🏆 Protocols Analyzed: ${data.length}`);
  }

  // private weiToEth(weiString: number): number {
  //   const wei = BigInt(weiString);
  //   const eth = Number(wei) / 1e18;
  //   return eth;
  // }
}