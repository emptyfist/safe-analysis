import axios, { AxiosResponse, AxiosError } from 'axios';
import config from './config';
import type {
  AnalyzedInfo,
  DuneMultiSendTransaction,
} from './types';
import { ParseTransaction } from './parse-tx';


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
  }

  async getAnalyzedData(queryId: number, days: number): Promise<AnalyzedInfo[]> {
    // Input validation
    if (queryId <= 0) return [];

    try {
      // execute query and get executionId
      const executionId = await this.executeQuery(queryId, { pastPeriod: days });
      // get data from executionId
      return await this.getPaginatedData<AnalyzedInfo>(executionId);
    } catch (error) { 
      return [];
    }
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

  async getMultiSendTransactions(queryId: number, days: number): Promise<string[]> {
    // Input validation
    if (queryId <= 0) return [];

    try {
      // execute query and get executionId
      const executionId = await this.executeQuery(queryId, { pastPeriod: days });
      // get data from executionId
      const data = await this.getPaginatedData<DuneMultiSendTransaction>(executionId);
      // parse data
      return this.parseTx.parseMultiSendTransaction(data);
    } catch (error) {
      return [];
    }
  }

  private async getPaginatedData<T>(executionId: string): Promise<T[]> {
    const perPage = config.dataPerQuery;
    let currentPage = 1;
    let hasMoreData = true;
    let url = '';
    const allPages: T[][] = [];

    try {
      while (hasMoreData) {
        url = `${this.baseUrl}/execution/${executionId}/results?limit=${perPage}&offset=${(currentPage - 1) * perPage}`;
        const data = await this.pollForResults<T>(url);

        // Early exit if no data returned
        if (!data || data.length === 0) {
          hasMoreData = false;
          break;
        }

        allPages.push(data);

        hasMoreData = data.length >= perPage;
        currentPage++;
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    // Use flat instead of reduce for better performance
    return allPages.flat();
  }

  private async pollForResults<T>(
    url: string,
    maxAttempts: number = config.maxRetries,
  ): Promise<T[]> {

    console.log(`Query for ${url} started....`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response: AxiosResponse<DuneResultsResponse<T>> = await axios.get(
          url,
          {
            headers: {
              'X-Dune-API-Key': this.apiKey,
            },
            timeout: this.timeout,
          },
        );

        const { state, result, error } = response.data;

        if (state === 'QUERY_STATE_COMPLETED' && result) {
          console.log('Query completed successfully');
          return result.rows;
        } else if (state === 'QUERY_STATE_FAILED') {
          throw new Error(`Query execution failed: ${error || 'Unknown error'}`);
        }

        console.log(`Query still running... (attempt ${attempt + 1}/${maxAttempts})`);
        // Exponential backoff: base delay * 2^attempt, with jitter
        const baseDelay = config.retryDelay;
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
        const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
        console.log(`Waiting ${Math.round(delay)}ms before next attempt...`);
        await this.sleep(delay);
      } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          console.log('Rate limited, waiting longer...');
          // Exponential backoff for rate limiting: 5s * 2^attempt
          const rateLimitDelay = Math.min(5000 * Math.pow(2, attempt), 60000); // Cap at 60 seconds
          console.log(`Rate limited, waiting ${Math.round(rateLimitDelay)}ms...`);
          await this.sleep(rateLimitDelay);
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