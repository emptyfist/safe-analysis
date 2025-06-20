import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
  duneApiKey: string;
  defaultDays: number;
  defaultTopCount: number;
  outputDir: string;
  apiTimeout: number;
  maxRetries: number;
  retryDelay: number;
  duneQueryIdForTransactions: number;
  duneQueryIdForStatistics: number;
  duneQueryIdForLabels: number;
  analyzeWithLabel: boolean;
  dataPerQuery: number;
}

const config: Config = {
  defaultDays: parseInt(process.env.DEFAULT_DAYS || '30'),
  defaultTopCount: parseInt(process.env.DEFAULT_TOP_COUNT || '100'),
  dataPerQuery: parseInt(process.env.DATA_PER_QUERY || '1000'),
  outputDir: process.env.OUTPUT_DIR || 'output',
  apiTimeout: parseInt(process.env.API_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '60'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '2000'),
  duneApiKey: process.env.DUNE_API_KEY || '',
  duneQueryIdForTransactions: parseInt(process.env.DUNE_SAFE_TRANSACTIONS || '5281902'),
  duneQueryIdForStatistics: parseInt(process.env.DUNE_STATISTICS_NON_MULTISEND || '5312034'),
  duneQueryIdForLabels: parseInt(process.env.DUNE_CONTRACT_LABELS || '5282105'),
  analyzeWithLabel: parseInt(process.env.ANALYZE_WITH_LABEL || '0') === 1,
};

export default config;