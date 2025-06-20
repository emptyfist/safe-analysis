import { promises as fs } from 'fs';
import * as path from 'path';
import config from './config';
import { DuneAnalytics } from './dune-query';
import type { AnalyzedTransaction } from './types';

interface ProtocolResult {
  interactions: number;
  name: string;
}

interface ExportData {
  metadata: {
    generated_at: string;
    analysis_period_days: number;
    top_count: number;
  };
  nonMultiSend: ProtocolResult[];
  multiSend: ProtocolResult[];
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

      this.dictionary = await this.duneQuery.getContractNames(config.duneQueryIdForLabels);

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
    data: AnalyzedTransaction[], 
    interactAddresses: string[]
  ): Promise<Record<string, AnalyzedTransaction>> {
    const days = config.defaultDays;
    const topCount = config.defaultTopCount;

    // Pre-allocate result object for better performance
    const result: Record<string, AnalyzedTransaction> = {};
    const dictionary = this.dictionary;

    // Process transactions in a single pass
    for (const address of interactAddresses) {
      const normalizedAddress = address.toLowerCase();
      const existing = result[normalizedAddress];
      
      if (existing) {
        existing.tx_count ++;
      } else {
        result[normalizedAddress] = {
          tx_count: 1,
          namespace: config.analyzeWithLabel ? (dictionary[normalizedAddress] ?? '') : normalizedAddress,
          total_gas: 0
        };
      }
    }

    // Sort & Limit with interaction count
    const rankedMultiSendData = Object.values(result)
      .sort((a, b) => b.tx_count - a.tx_count)
      .slice(0, topCount);

    await this.exportResults(data, rankedMultiSendData, { days, topCount });
    this.generateSummary(data, rankedMultiSendData);

    return result;
  }

  private async exportResults(
    analyzedData: AnalyzedTransaction[], 
    rankedMultiSendData: AnalyzedTransaction[], 
    metadata: { days: number; topCount: number }
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `safe-analysis-${timestamp}`;

    try {
      await this.exportAsJson(analyzedData, rankedMultiSendData, filename, metadata);
    } catch (error) {
      const err = error as Error;
      console.error('❌ Export failed:', err.message);
    }
  }

  private async exportAsJson(
    analyzedData: AnalyzedTransaction[], 
    rankedMultiSendData: AnalyzedTransaction[], 
    filename: string, 
    metadata: { days: number; topCount: number }
  ): Promise<void> {
    const output: ExportData = {
      metadata: {
        generated_at: new Date().toISOString(),
        analysis_period_days: metadata.days,
        top_count: metadata.topCount,
      },
      nonMultiSend: analyzedData.map(protocol => ({
        name: protocol.namespace,
        interactions: protocol.tx_count,
      })),
      multiSend: rankedMultiSendData.map(protocol => ({
        name: protocol.namespace,
        interactions: protocol.tx_count,
      }))
    };

    const filepath = path.join(this.outputDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`📄 Results exported to: ${filepath}`);
  }

  private generateSummary(
    analyzedData: AnalyzedTransaction[], 
    rankedMultiSendData: AnalyzedTransaction[]
  ): void {
    const totals = analyzedData.reduce((acc, protocol) => {
      acc.transactions += +protocol.tx_count;
      acc.gas += +protocol.total_gas;
      return acc;
    }, { transactions: 0, gas: 0 });

    console.log('\n📈 TOP PROTOCOLS ANALYSIS SUMMARY');
    console.log('═'.repeat(50));
    console.log(`📊 Total Transactions: ${totals.transactions.toLocaleString()}`);
    console.log(`⛽ Total Gas Used (Wei): ${totals.gas.toLocaleString()}`);
    console.log(`🏆 Protocols Analyzed: ${analyzedData.length}`);

    const multiSendTotals = rankedMultiSendData.reduce((acc, protocol) => {
      acc += +protocol.tx_count;
      return acc;
    }, 0);

    console.log('\n📊 TOP MULTI-SEND PROTOCOLS ANALYSIS SUMMARY');
    console.log('═'.repeat(50));
    console.log(`📊 Total Transactions: ${multiSendTotals.toLocaleString()}`);
    console.log(`🏆 Protocols Analyzed: ${rankedMultiSendData.length}`);
  }
}