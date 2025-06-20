import { type Hex } from 'viem';

export interface ParsedTransaction {
  to: string;
  gas: number;
  value: number;
}

export type AnalyzedTransaction = {
  namespace: string;
  tx_count: number;
  total_gas: number;
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
  safeTxGas: number;
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