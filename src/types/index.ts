/**
 * Configuration interface for the TON indexer
 */
export interface IndexerConfig {
  tonApiKey: string;
  graphqlUrl: string;
  restUrl: string;
  cursorFilePath: string;
  dataDirectory: string;
  maxConcurrentRequests: number;
  requestDelayMs: number;
  accountsPerPage: number;
  maxRetries: number;
  retryDelayMs: number;
  logLevel: string;
  logPretty: boolean;
}

/**
 * GraphQL PageInfo for pagination
 */
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/**
 * Account node from GraphQL response
 */
export interface AccountNode {
  rawAddress: string;
}

/**
 * GraphQL response for allAccounts query
 */
export interface AllAccountsResponse {
  allAccounts: {
    pageInfo: PageInfo;
    nodes: AccountNode[];
  };
}

/**
 * Variables for GraphQL query
 */
export interface GraphQLVariables {
  first: number;
  after?: string | null;
  [key: string]: any; // Index signature for graphql-request compatibility
}

/**
 * Contract inspection data from REST API
 */
export interface ContractInspectData {
  address: string;
  account: {
    address: string;
    balance: number;
    last_activity: number;
    status: string;
    interfaces?: string[];
    get_methods?: string[];
    is_suspended?: boolean;
    is_wallet?: boolean;
  };
  block?: {
    workchain: number;
    shard: string;
    seqno: number;
    root_hash: string;
    file_hash: string;
  };
  libraries?: any[];
  boc?: string;
  code_boc?: string;
  code_hash?: string;
  data_boc?: string;
  data_hash?: string;
}

/**
 * API error response
 */
export interface ApiError {
  error: string;
  message?: string;
  status_code?: number;
}

/**
 * Processing result for a single account
 */
export interface ProcessingResult {
  address: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  filePath?: string;
}

/**
 * Batch processing summary
 */
export interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ address: string; error: string }>;
}

/**
 * Result of a single indexer iteration
 */
export interface IterationResult {
  summary: BatchSummary;
  hasNextPage: boolean;
  endCursor: string | null;
} 