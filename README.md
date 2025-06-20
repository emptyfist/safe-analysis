# Safe Analysis

## Presentation
[Working.webm](https://github.com/user-attachments/assets/4b7aa634-e07a-4dee-8613-166ad9ed9035)

A TypeScript-based analytics tool for analyzing Safe multisig wallet protocol interactions on Ethereum mainnet using Dune Analytics data.

## Purpose

Safe Analysis provides comprehensive insights into how Safe multisig wallets interact with different protocols on Ethereum. The tool leverages Dune Analytics' powerful querying capabilities to:

- **Protocol Interaction Analysis**: Analyze which protocols Safe wallets interact with most frequently
- **Multi-send Transaction Decoding**: Decode Safe's multi-send operations to extract individual protocol interactions
- **Statistical Data Analysis**: Process non-multi-send Safe wallet transactions for comprehensive insights
- **Smart Contract Label Resolution**: Optionally resolve contract addresses to human-readable protocol names
- **Top Protocol Rankings**: Generate ranked lists of the most popular protocols based on interaction frequency
- **Data Export**: Export analysis results in structured JSON format for further processing

## Installation

### Prerequisites

Before installing Safe Analysis, ensure you have the following prerequisites:

- **Node.js** (v18.0.0 or higher)
- **npm** or **yarn** package manager
- **TypeScript** (v5.0.0 or higher)
- **Dune Analytics API Key** (required for data fetching)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/emptyfist/safe-analysis.git
cd safe-analysis
```

#### 2. Install Dependencies

```bash
# Using npm
npm install

# Using yarn
yarn install
```

#### 3. Environment Configuration

Create a `.env` file in the project root with your configuration:

```bash
# Required: Dune Analytics API Key
DUNE_API_KEY=your_dune_api_key_here

# Query Configuration
DUNE_SAFE_TRANSACTIONS=5281902
DUNE_STATISTICS_NON_MULTISEND=5312034
DUNE_CONTRACT_LABELS=5282105

# Analysis Settings
ANALYZE_WITH_LABEL=0
DEFAULT_DAYS=30
DEFAULT_TOP_COUNT=100
DATA_PER_QUERY=1000

# Optional: Custom output directory
OUTPUT_DIR=output
```

#### 4. Build the Project

```bash
npm run build
```

## Usage

### Basic Usage

#### Command Line Interface

Run the analysis with default settings (last 30 days, top 100 protocols):

```bash
npm start
```

#### Available CLI Options

```bash
# Show help
npm start -- --help
```

### Advanced Configuration

#### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DUNE_API_KEY` | Your Dune Analytics API key | - | ✅ |
| `DUNE_SAFE_TRANSACTIONS` | Dune query ID for Safe multi-send transactions | 5281902 | ✅ |
| `DUNE_STATISTICS_NON_MULTISEND` | Dune query ID for non-multi-send statistics | 5312034 | ✅ |
| `DUNE_CONTRACT_LABELS` | Dune query ID for contract labels | 5282105 | ✅ |
| `ANALYZE_WITH_LABEL` | Enable contract name resolution (0/1) | 0 | ❌ |
| `DEFAULT_DAYS` | Default analysis period in days | 30 | ❌ |
| `DEFAULT_TOP_COUNT` | Default number of top protocols | 100 | ❌ |
| `DATA_PER_QUERY` | Records per API request | 1000 | ❌ |
| `OUTPUT_DIR` | Output directory for results | output | ❌ |
| `API_TIMEOUT` | API request timeout in ms | 30000 | ❌ |
| `MAX_RETRIES` | Maximum API retry attempts | 60 | ❌ |
| `RETRY_DELAY` | Delay between retries in ms | 2000 | ❌ |

#### Contract Label Resolution

The tool can optionally resolve contract addresses to protocol names using Dune's contract labels:

```bash
# Enable label resolution (requires more API credits)
ANALYZE_WITH_LABEL=1

# Disable for faster analysis (recommended for initial runs)
ANALYZE_WITH_LABEL=0
```

**⚠️ Important Recommendations for ANALYZE_WITH_LABEL=1:**

When enabling contract label resolution, consider the following recommendations to optimize performance and manage costs:

**Resource Management:**
- **Increase System Memory**: Label resolution loads a large dictionary into memory. Ensure your system has at least 4GB available RAM
- **Reduce Batch Size**: Lower `DATA_PER_QUERY` from 1000 to 500 or 250 to reduce memory pressure per request
- **Monitor API Credits**: This feature can consume 10-20x more Dune credits due to additional label queries

**Performance Optimization:**
```bash
# Recommended settings for label resolution
ANALYZE_WITH_LABEL=0
DATA_PER_QUERY=500
DEFAULT_TOP_COUNT=50
```

**Cost Management:**
- **Start Small**: Begin with shorter time periods (7 days) and fewer results (top 50) to estimate credit usage
- **Cache Awareness**: The tool caches label data in `output/dictionary.json` - subsequent runs will be faster and use fewer credits
- **Selective Usage**: Only enable labels for final analyses; use `ANALYZE_WITH_LABEL=0` for exploratory work

**Troubleshooting Label Resolution:**
- If you encounter memory errors, disable labels and use address-only mode
- Label cache files are saved in the output directory for reuse
- Clear the cache by deleting `output/dictionary.json` if you need fresh label data

**Credit Estimation**: A typical 30-day analysis with labels enabled may consume 50-100 Dune credits compared to 5-10 credits without labels.

### Development Usage

#### Development Mode

```bash
# Run in development mode with ts-node
npm run dev
```

#### Build and Watch

```bash
# Watch for changes and rebuild
npm run watch
```

#### Type Checking

```bash
# Run TypeScript type checking
npm run type-check
```

#### Linting

```bash
# Run ESLint
npm run lint
```

#### Clean Build

```bash
# Clean and rebuild
npm run clean && npm run build
```

### Output Format

The tool generates JSON files in the specified output directory with the following structure:

```json
{
  "metadata": {
    "generated_at": "2025-06-15T10:30:00.000Z",
    "analysis_period_days": 30,
    "top_count": 100
  },
  "nonMultiSend": [
    {
      "name": "uniswap v3",
      "interactions": 1247
    }
  ],
  "multiSend": [
    {
      "name": "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
      "interactions": 892
    }
  ]
}
```

### Understanding the Results

The analysis provides several key metrics:

- **Interactions**: Number of times Safe wallets interacted with each protocol
- **Protocol Names**: Human-readable protocol names (when label resolution is enabled) or contract addresses
- **Multi-send vs Non-multi-send**: Separate analysis for different transaction types
- **Gas Usage**: Total gas consumed in interactions (if available in the data)

### Transaction Decoding Features

The tool includes sophisticated transaction decoding capabilities:

- **Multi-send Transaction Parsing**: Decodes Safe's multi-send operations to extract individual protocol interactions
- **ERC20 Transfer Detection**: Identifies and decodes ERC20 token transfers within transactions
- **Final Destination Resolution**: For token transfers, resolves the ultimate recipient address
- **Operation Type Handling**: Distinguishes between CALL and DELEGATECALL operations

### API Rate Limiting

To avoid hitting Dune Analytics rate limits:

- The tool implements automatic retry logic with exponential backoff
- Rate limit detection and handling (HTTP 429 responses)
- Configurable timeout and retry parameters
- Efficient pagination to minimize API calls

### Troubleshooting

#### Common Issues

**API Key Issues**:
```bash
❌ Analysis failed: Dune API key not configured
💡 Make sure to set your DUNE_API_KEY in your environment variables or .env file
```

**Rate Limiting**:
```bash
Query still running... (attempt 1/60)
Rate limited, waiting longer...
```

**Memory Issues** (when using label resolution):
- Reduce `DATA_PER_QUERY` value
- Set `ANALYZE_WITH_LABEL=0` to disable label resolution
- Analyze shorter time periods

#### Debug Mode

```bash
# Enable debug logging (if implemented)
DEBUG=safe-analysis npm start
```

### Performance Considerations

- **Label Resolution**: Significantly increases processing time and memory usage
- **Time Period**: Longer analysis periods require more API calls and processing time
- **Top Count**: Higher values require processing more data but don't significantly impact API usage
- **API Credits**: Each analysis consumes Dune Analytics credits based on query complexity and data volume

For optimal performance, start with shorter time periods and smaller top counts, then scale up as needed.

## Project Structure

```
safe-analysis/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── analyze-safe.ts       # Core analysis logic
│   ├── dune-query.ts         # Dune Analytics API integration
│   ├── parse-tx.ts           # Transaction parsing utilities
│   ├── config/
│   │   └── index.ts          # Configuration management
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── sample/                   # Sample data and demo files
├── output/                   # Generated analysis results
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

### Production Dependencies
- **viem**: Ethereum interaction library
- **axios**: HTTP client for API requests
- **dotenv**: Environment variable management

### Development Dependencies
- **TypeScript**: Type safety and compilation
- **ts-node**: TypeScript execution in development
- **ESLint**: Code linting
- **rimraf**: Cross-platform file deletion
- **nodemon**: Development file watching