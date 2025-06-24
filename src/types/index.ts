import { type Hex } from 'viem';

export interface ParsedTransaction {
  to: string;
  gas: number;
  value: number;
}

export type AnalyzedInfo = {
  namespace: string;
  tx_cnt: number;
  gas: number;
  to: string;
  value: number;
}

// Types for MultiSend transaction structure
export interface MultiSendTransaction {
  operation: number; // 0 = CALL, 1 = DELEGATECALL
  to: string;
  value: bigint;
  data: Hex;
  dataLength: number;
}

export interface DuneMultiSendTransaction {
  to: string;
  gas: number;
  value: number;
  data: Hex;
}

// Validation interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Performance metrics
export interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  transactionCount: number;
}