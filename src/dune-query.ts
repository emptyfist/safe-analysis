import axios, { AxiosResponse, AxiosError } from 'axios';
import config from './config';
import { DuneTransaction, ParsedTransaction } from './types';
import { ParseTransaction } from './parse-tx';

type ContractLabel = {
  address: string;
  name: string;
  namespace: string;
}

type DuneExecuteResponse = {
  execution_id: string;
  state: string;
}

type DuneResultsResponse<T> = {
  execution_id: string;
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED';
  result?: {
    rows: T[];
    metadata: {
      column_names: string[];
      result_set_bytes: number;
      total_row_count: number;
    };
  };
  error?: string;
}

export class DuneAnalytics {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly parseTx: ParseTransaction;

  constructor() {
    this.apiKey = config.duneApiKey;
    this.baseUrl = 'https://api.dune.com/api/v1';
    this.timeout = config.apiTimeout;
    this.parseTx = new ParseTransaction();
    
    if (!this.apiKey) {
      console.warn('Warning: Dune API key not configured. Using mock data.');
    }
  }

  async getContractNames(queryId: number) {
    let result: Map<string, string> = new Map<string, string>()
    const perPage = config.dataPerQuery;
    let currentPage = 1;
    let hasMoreData = true;

    try {
      // while (hasMoreData) {
        const data = await this.pollForResults<ContractLabel>(queryId, perPage, (currentPage - 1) * perPage);
        data.reduce((map, item) => {
          map.set(item.address.toLowerCase(), item.namespace);
          return map;
        }, result);

        hasMoreData = data.length >= perPage;
        currentPage ++;
      // }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return result;
  }

  async getSafeTransactions(
    queryId: number, 
    parameters: Record<string, any> = {}
  ): Promise<ParsedTransaction[]> {
    let result: ParsedTransaction[] = [];
    const perPage = config.dataPerQuery;
    let currentPage = 1;
    let hasMoreData = true;

    try {
      // const executionId = await this.executeQuery(queryId/*, parameters*/);

      // while (hasMoreData) {
        const data = await this.pollForResults<DuneTransaction>(queryId, perPage, (currentPage - 1) * perPage);

        const parsedResults = await this.parseTx.decodeSafeTransaction(data);
        result = result.concat(parsedResults);

        hasMoreData = data.length >= perPage;
        currentPage ++;
      // }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return result;
  }

  private async executeQuery(
    queryId: number, 
    parameters: Record<string, any> = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Dune API key not configured');
    }

    try {
      console.log(`Executing Dune query ${queryId}...`);
      
      const executeResponse: AxiosResponse<DuneExecuteResponse> = await axios.post(
        `${this.baseUrl}/query/${queryId}/execute`,
        { query_parameters: parameters },
        {
          headers: {
            'X-Dune-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return executeResponse.data.execution_id;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Dune query execution failed:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  }

  private async pollForResults<T>(
    // executionId: string, 
    queryId: number,
    limit: number = 1000,
    offset: number = 0,
    maxAttempts: number = config.maxRetries
  ): Promise<T[]> {

    const url = `${this.baseUrl}/query/${queryId}/results?limit=${limit}&offset=${offset}`;

    console.log(`Query for ${url} started....`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response: AxiosResponse<DuneResultsResponse<T>> = await axios.get(
          // `${this.baseUrl}/execution/${executionId}/results?limit=${limit}&offset=${offset}`,
          url,
          {
            headers: {
              'X-Dune-API-Key': this.apiKey
            },
            timeout: this.timeout
          }
        );

        const { state, result, error } = response.data;

        if (state === 'QUERY_STATE_COMPLETED' && result) {
          console.log('Query completed successfully');
          return result.rows;
        } else if (state === 'QUERY_STATE_FAILED') {
          throw new Error(`Query execution failed: ${error || 'Unknown error'}`);
        }

        console.log(`Query still running... (attempt ${attempt + 1}/${maxAttempts})`);
        await this.sleep(config.retryDelay);
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          console.log('Rate limited, waiting longer...');
          await this.sleep(5000);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Query execution timed out');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}