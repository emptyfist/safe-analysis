import { promises as fs } from 'fs';
import * as path from 'path';
import { formatEther } from 'viem';
import config from './config';
import type { AnalyzedInfo } from './types';

interface ExportData {
  metadata: {
    generated_at: string;
    analysis_period_days: number;
    top_count: number;
  };
  result: AnalyzedInfo[];
}

export class AnalyzeSafe {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async summarize(
    days: number,
    analyzedData: AnalyzedInfo[],
    multiSendAddresses: string[],
  ) {
    const topCount = config.defaultTopCount;

    const result: Record<string, AnalyzedInfo> = Object.fromEntries(
      analyzedData.map(data => {
        try {
          return [data.to.toLowerCase(), data]
        } catch (error) {
          console.error('❌ Error parsing address:', error);
          return ['', {
            tx_cnt: 0,
            namespace: '',
            to: '',
            gas: 0,
            value: 0,
          }]
        }
      })
    );

    // Process transactions in a single pass
    for (const address of multiSendAddresses) {
      const normalizedAddress = address.toLowerCase();
      const existing = result[normalizedAddress];
      if (existing) {
        existing.tx_cnt += 1;
      } else {
        result[normalizedAddress] = {
          tx_cnt: 1,
          namespace: '',
          to: normalizedAddress,
          gas: 0,
          value: 0,
        };
      }
    }

    // Sort & Limit with interaction count
    const rankedMultiSendData = Object.values(result)
      .sort((a, b) => b.tx_cnt - a.tx_cnt)
      .slice(0, topCount);

    await this.exportResults(rankedMultiSendData, days, topCount);
    this.generateSummary(rankedMultiSendData, days, topCount);
  }

  private async exportResults(
    result: AnalyzedInfo[],
    days: number,
    topCount: number,
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `safe-analysis-${timestamp}`;

    try {
      const output: ExportData = {
        metadata: {
          generated_at: new Date().toISOString(),
          analysis_period_days: days,
          top_count: topCount,
        },
        result
      };
  
      const filepath = path.join(this.outputDir, `${filename}.json`);
      await fs.writeFile(filepath, JSON.stringify(output, null, 2));
      console.log(`📄 Results exported to: ${filepath}`);

    } catch (error) {
      const err = error as Error;
      console.error('❌ Export failed:', err.message);
    }
  }

  private generateSummary(
    result: AnalyzedInfo[],
    days: number,
    topCount: number,
  ): void {
    const totals = result.reduce((acc, protocol) => {
      acc.transactions += +protocol.tx_cnt;
      acc.gas += +protocol.gas;
      acc.value += +protocol.value;
      return acc;
    }, { transactions: 0, gas: 0, value: 0 });

    console.log('\n📈 TOP PROTOCOLS ANALYSIS SUMMARY');
    console.log('═'.repeat(50));
    console.log(`📊 Total Transactions: ${totals.transactions.toLocaleString()}`);
    console.log(`⛽ Total Gas Used (ETH): ${formatEther(BigInt(totals.gas))}`);
    console.log(`⛽ Total Transfered ETH Value: ${formatEther(BigInt(totals.value))}`);
  }
}