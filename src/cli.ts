#!/usr/bin/env node
import { runAudit, writeReports } from './audit.js';

interface CliArgs {
  help?: boolean;
  baseUrl?: string;
  apiKeyEnv: string;
  model?: string;
  prompt: string;
  repeat: number;
  stream: boolean;
  timeoutMs: number;
  out: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    apiKeyEnv: 'OPENAI_API_KEY',
    prompt: 'Say hello in one short sentence.',
    repeat: 1,
    stream: false,
    timeoutMs: 60000,
    out: `reports/audit-${new Date().toISOString().replace(/[:.]/g, '-')}`
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...args, help: true };
    if (arg === '--stream') {
      args.stream = true;
      continue;
    }
    if (arg === '--non-stream') {
      args.stream = false;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    i += 1;
    if (arg === '--base-url') args.baseUrl = next;
    else if (arg === '--api-key-env') args.apiKeyEnv = next;
    else if (arg === '--model') args.model = next;
    else if (arg === '--prompt') args.prompt = next;
    else if (arg === '--repeat') args.repeat = parseInteger(next, arg, 1, 20);
    else if (arg === '--timeout-ms') args.timeoutMs = parseInteger(next, arg, 1000, 300000);
    else if (arg === '--out') args.out = next.replace(/\.(json|md)$/i, '');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function parseInteger(value: string, name: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function helpText(): string {
  return `llm-gateway-audit v0.1.0

Usage:
  llm-gateway-audit --base-url <url> --model <model> [options]
`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
    return;
  }
  if (!args.baseUrl) throw new Error('--base-url is required');
  if (!args.model) throw new Error('--model is required');
  const apiKey = process.env[args.apiKeyEnv];
  if (!apiKey) throw new Error(`Environment variable ${args.apiKeyEnv} is required`);
  const report = await runAudit({ ...args, baseUrl: args.baseUrl, model: args.model, apiKey });
  const paths = await writeReports(report, args.out);
  console.log(`Audit complete. JSON: ${paths.jsonPath}`);
  console.log(`Markdown: ${paths.markdownPath}`);
  console.log(`Suspicious score: ${report.summary.suspiciousScore}/100 (${report.summary.riskLevel})`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
