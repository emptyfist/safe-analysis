import { Abi, decodeFunctionData, getAbiItem, hexToBytes, parseAbi, bytesToBigInt, bytesToNumber, bytesToHex, type AbiFunction, type Hex } from 'viem';
import type { DuneTransaction, MultiSendTransaction, ParsedTransaction } from './types/index';

const COMMON_ERC20_TRANSFER_SIGNATURE: Record<string, string> = {
  '0xa9059cbb': 'function transfer(address to, uint256 amount) external returns (bool)',
  '0x23b872dd': 'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  // '0x095ea7b3': 'function approve(address spender, uint256 amount) external returns (bool)',
  // '0x70a08231': 'function balanceOf(address account) external view returns (uint256)',
  // '0xdd62ed3e': 'function allowance(address owner, address spender) external view returns (uint256)',
  // '0x18160ddd': 'function totalSupply() external view returns (uint256)',
  // '0x06fdde03': 'function name() external view returns (string memory)',
  // '0x95d89b41': 'function symbol() external view returns (string memory)',
  // '0x313ce567': 'function decimals() external view returns (uint8)',
  // '0x2e1a7d4d': 'function withdraw(uint256 amount) external',
  // '0xd0e30db0': 'function deposit() external payable',
  // '0x12210e8a': 'function executeMetaTransaction(address userAddress, bytes memory functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) external payable returns (bytes memory)',
};

export class ParseTransaction {
  private readonly abiCache = new Map<string, Abi>();
  private readonly multisendAbi: Abi;

  constructor() {
    // Pre-parse commonly used ABIs
    this.multisendAbi = parseAbi([
      'function multiSend(bytes memory transactions) public payable',
    ]);
  }

  decodeSafeTransaction(rawData: DuneTransaction[]): ParsedTransaction[] {
    // Input validation
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    try {
      return rawData.reduce((result: ParsedTransaction[], tx) => {
        const { to, data, operation, safeTxGas, value } = tx;
        
        if (operation === 0) {
          result.push({
            to: to.toLowerCase(),
            gas: safeTxGas,
            value
          });
        } else {
          result.push(...this.decodeMultiSend(data));
        }
        
        return result;
      }, []);
    } catch (error) {
      throw new Error(`Failed to decode Safe transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decode multiSend transactions
   */
  private decodeMultiSend(data: Hex): ParsedTransaction[] {
    try {
      const decoded = decodeFunctionData({
        abi: this.multisendAbi,
        data
      });

       if (decoded.functionName !== 'multiSend') {
        return [];
      }

      // Extract transactions from multi-send hex data
      const transactionsData = this.parseMultiSendTransactions(decoded.args?.[0] as Hex || '0x');

      // Decode each transactions in details to get final destination address
      /*
      Extract final destination address if transaction is transfer or transferFrom, 
      
      eg:
                                     Final_DESTINATION_ADDRESS 
      From 0x88eaFE23...3e6acFbD5 To 0x6499Add1...0ceF519C5 For 1,048.729079618851687676 ($3,491.22) Peapods (PEAS)
      From 0x88eaFE23...3e6acFbD5 To 0xC64bc025...C4a56362B For 2,283.910127 ($2,283.42) USDC (USDC)

      */

      return transactionsData.map(tx => this.decodeFunction(tx));
    } catch (error) {
      return [];
    }
  }

  private decodeFunction(tx: MultiSendTransaction): ParsedTransaction {
    const { data } = tx;

    const selector = data.slice(0, 10) as Hex;
    const abi = this.getCommonFunctionAbi(selector);
    if (!abi) {
      return {
        to: tx.to.toLowerCase(), 
        gas: 0, 
        value: Number(tx.value)
      };
    }

    // Decode the function data
    const decoded = decodeFunctionData({
      abi,
      data
    });

    // Get function details
    const abiFunction = getAbiItem({
      abi,
      name: decoded.functionName
    }) as AbiFunction;

    // Create argument mapping
    const args: Record<string, any> = {};
    if (abiFunction.inputs && decoded.args) {
      abiFunction.inputs.forEach((input, index) => {
        // Use optional chaining to safely access decoded.args
        const argValue = decoded.args?.[index];
        if (argValue !== undefined) {
          args[input.name || `arg${index}`] = this.formatArgument(
            argValue, 
            input.type
          );
        }
      });
    }

    return {
      to: (args?.['to']?.toString() || tx.to).toLowerCase(),
      gas: 0,
      value: args?.['amount']
    }
  }

  /**
   * Format argument based on its type
   */
  private formatArgument(value: unknown, type: string): any {
    if (type.startsWith('uint') || type.startsWith('int')) {
      return typeof value === 'bigint' ? value.toString() : value;
    }
    
    if (type === 'address') {
      return value;
    }
    
    if (type === 'bool') {
      return value;
    }
    
    if (type === 'bytes' || type.startsWith('bytes')) {
      return value;
    }
    
    if (type === 'string') {
      return value;
    }
    
    if (type.endsWith('[]')) {
      return Array.isArray(value) ? value.map((v, i) => 
        this.formatArgument(v, type.slice(0, -2))
      ) : value;
    }
    
    return value;
  }

  /**
   * Get common function ABIs by selector with caching
   */
  private getCommonFunctionAbi(selector: Hex): Abi | undefined {
    // Check cache first
    if (this.abiCache.has(selector)) {
      return this.abiCache.get(selector);
    }

    const signature = COMMON_ERC20_TRANSFER_SIGNATURE[selector];
    if (signature) {
      try {
        const abi = parseAbi([signature]);
        // Cache the parsed ABI
        this.abiCache.set(selector, abi);
        return abi;
      } catch {
        return undefined;
      }
    }

    return undefined;
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
          dataLength
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