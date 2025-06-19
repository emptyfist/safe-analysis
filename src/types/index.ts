import { type Hex } from 'viem';

export interface AnalysisOptions {
  days: number;
  topCount: number;
}

export interface CommandLineArgs {
  days?: number;
  topCount?: number;
  help?: boolean;
}

export interface ParsedTransaction {
  to: string;
  gas: number;
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

export interface DuneTransaction {
  to: string;
  baseGas: number;
  safeTxGas: number;
  value: number;
  data: Hex;
  operation: number;
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