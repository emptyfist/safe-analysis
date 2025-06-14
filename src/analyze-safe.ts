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
  private dictionary: Map<string, string>;

  constructor(outputDir: string) {
    this.duneQuery = new DuneAnalytics();
    this.dictionary = new Map<string, string>();
    this.outputDir = outputDir;
  }

  async loadDictionary() {
    const filepath = path.join(this.outputDir, 'dictionary.json');

    try {
      // Check if file exists
      await fs.access(filepath);
      
      // File exists - load data from file to map variable and exit function
      console.log(`Loading to cache...`);
      
      const fileContent = await fs.readFile(filepath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      // Convert JSON object back to Map
      this.dictionary = new Map<string, string>(Object.entries(jsonData));
      console.log(`Loaded ${this.dictionary.size} entries from dictionary`);
    } catch (error) {
      // File doesn't exist - get data from Dune API
      console.log(`Dictionary is not existing, fetching from Dune API...`);

      this.dictionary = await this.duneQuery.getContractNames(config.duneLabels)      

      // Create map from API data and save to file
      await this.saveDictionaryToFile(filepath);
      
      console.log(`Fetched and saved ${this.dictionary.size} entries`);
    }
  }

    /**
   * Helper method to save dictionary Map to file as JSON
   */
  private async saveDictionaryToFile(filePath: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Convert Map to plain object for JSON serialization
      const jsonObject = Object.fromEntries(this.dictionary);
      
      // Save to file with pretty formatting
      await fs.writeFile(filePath, JSON.stringify(jsonObject, null, 2), 'utf-8');
      
      console.log(`Dictionary saved to`);
    } catch (error) {
      console.error(`Error saving dictionary to file: ${error}`);
      throw error;
    }
  }

  async handle(
    data: ParsedTransaction[], 
    options: AnalysisOptions, 
  ) {
    const { days, topCount } = options;

    const result = data.reduce((acc, { to, gas }) => {
      const existProtocol = acc.get(to);
      let contractName = '';
      if (config.analyzeWithLabel) {
        contractName = this.dictionary.get(to) ?? '';
      }

      if (!existProtocol) {
        acc.set(to, { interactions: 1, gas: Number(gas), name: contractName })
        return acc;
      }

      acc.set(to, { 
        interactions: existProtocol.interactions + 1, 
        gas: existProtocol.gas + Number(gas),
        name: contractName
      });

      return acc;
    }, new Map<string, ProtocolAnalysis>());

    // Sort & Limit with interaction count
    const topProtocols = [...result.entries()]
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

  private generateSummary(data: [string ,ProtocolAnalysis][]): void {
    const totalTransactions = data.reduce((sum, p) => sum + p[1].interactions, 0);
    const totalGas = data.reduce((sum, p) => sum + p[1].gas, 0);

    console.log('\n📈 TOP PROTOCOLS ANALYSIS SUMMARY');
    console.log('═'.repeat(50));
    console.log(`📊 Total Transactions: ${totalTransactions.toLocaleString()}`);
    console.log(`⛽ Total Gas Used (Wei): ${totalGas.toLocaleString()}`);
  }

  // private weiToEth(weiString: number): number {
  //   const wei = BigInt(weiString);
  //   const eth = Number(wei) / 1e18;
  //   return eth;
  // }
}