import {
  Abi,
  decodeFunctionData,
  hexToBytes,
  parseAbi,
  bytesToBigInt,
  bytesToNumber,
  bytesToHex,
  type Hex,
} from 'viem';
import type {
  DuneMultiSendTransaction,
  MultiSendTransaction,
} from '@/types';

// const COMMON_ERC20_TRANSFER_SIGNATURE: Record<string, string> = {
//   '0xa9059cbb': 'function transfer(address to, uint256 amount) external returns (bool)',
//   '0x23b872dd': 'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
//   '0x095ea7b3': 'function approve(address spender, uint256 amount) external returns (bool)',
//   '0x70a08231': 'function balanceOf(address account) external view returns (uint256)',
//   '0xdd62ed3e': 'function allowance(address owner, address spender) external view returns (uint256)',
//   '0x18160ddd': 'function totalSupply() external view returns (uint256)',
//   '0x06fdde03': 'function name() external view returns (string memory)',
//   '0x95d89b41': 'function symbol() external view returns (string memory)',
//   '0x313ce567': 'function decimals() external view returns (uint8)',
//   '0x2e1a7d4d': 'function withdraw(uint256 amount) external',
//   '0xd0e30db0': 'function deposit() external payable',
//   '0x12210e8a': 'function executeMetaTransaction(address userAddress, bytes memory functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) external payable returns (bytes memory)',
// };

export class ParseTransaction {
  private readonly abiCache = new Map<string, Abi>();
  private readonly multisendAbi: Abi;

  constructor() {
    // Pre-parse commonly used ABIs
    this.multisendAbi = parseAbi([
      'function multiSend(bytes memory transactions) public payable',
    ]);
  }

  decodeSafeTransaction(rawData: DuneMultiSendTransaction[]): string[] {
    // Input validation
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    try {
      return rawData.reduce((result: string[], tx) => {
        result.push(...this.decodeMultiSend(tx.data));
        return result;
      }, []);
    } catch (error) {
      throw new Error(`Failed to decode Safe transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decode multiSend transactions
   */
  private decodeMultiSend(data: Hex): string[] {
    try {
      const decoded = decodeFunctionData({
        abi: this.multisendAbi,
        data,
      });
      if (decoded.functionName !== 'multiSend') {
        return [];
      }

      // Extract transactions from multi-send hex data
      const transactionsData = this.parseMultiSendTransactions(decoded.args?.[0] as Hex || '0x');

      return transactionsData.map(tx => tx.to);
    } catch (error) {
      console.error('Error decoding multiSend transaction:', error);
      return [];
    }
  }

  /**
   * Parses the packed MultiSend transactions data
   */
  private parseMultiSendTransactions(transactionsData: Hex): MultiSendTransaction[] {
    const transactions: MultiSendTransaction[] = [];
    let offset = 0;
    const dataBytes = hexToBytes(transactionsData);

    while (offset < dataBytes.length) {
      try {
        // Read operation (1 byte)
        if (offset >= dataBytes.length) break;
        const operation = dataBytes[offset];
        offset += 1;

        // Read to address (20 bytes)
        if (offset + 20 > dataBytes.length) break;
        const toBytes = dataBytes.slice(offset, offset + 20);
        const to = bytesToHex(toBytes);
        offset += 20;

        // Read value (32 bytes)
        if (offset + 32 > dataBytes.length) break;
        const valueBytes = dataBytes.slice(offset, offset + 32);
        const value = bytesToBigInt(valueBytes);
        offset += 32;

        // Read data length (32 bytes)
        if (offset + 32 > dataBytes.length) break;
        const dataLengthBytes = dataBytes.slice(offset, offset + 32);
        const dataLength = bytesToNumber(dataLengthBytes);
        offset += 32;

        // Read data (dataLength bytes)
        if (offset + dataLength > dataBytes.length) break;
        const callDataBytes = dataBytes.slice(offset, offset + dataLength);
        const callData = bytesToHex(callDataBytes) as Hex;
        offset += dataLength;

        transactions.push({
          operation: operation as number,
          to,
          value,
          data: callData,
          dataLength,
        });

      } catch (error) {
        // If parsing fails, break the loop
        console.warn('Error parsing transaction at offset', offset, error);
        break;
      }
    }

    return transactions;
  }
}