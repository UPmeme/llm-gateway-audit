#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { runAudit, writeReports, redactUrl } from './audit.js';

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
  config?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    apiKeyEnv: 'OPENAI_API_KEY',
    prompt: 'Say hello in one short sentence.',
    repeat: 1,
    stream: false,
    timeoutMs: 60000,
    out: `reports/audit-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    dryRun: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...args, help: true };
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
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
    else if (arg === '--config') args.config = next;
    else if (arg === '--model') args.model = next;
    else if (arg === '--prompt') args.prompt = next;
    else if (arg === '--repeat') args.repeat = parseInteger(next, arg, 1, 20);
    else if (arg === '--timeout-ms') args.timeoutMs = parseInteger(next, arg, 1000, 300000);
    else if (arg === '--out') args.out = next.replace(/\.(json|md)$/i, '');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function loadConfig(path?: string): Promise<Partial<CliArgs>> {
  const configPath = path ?? 'llm-gateway-audit.config.json';
  if (!path) {
    try {
      await access(configPath);
    } catch {
      return {};
    }
  }
  const raw = await readFile(configPath, 'utf8');
  const config = JSON.parse(raw);
  const forbidden = ['api_key', 'apiKey', 'authorization', 'token', 'prompt', 'messages'];
  const presentForbidden = forbidden.filter((key) => Object.prototype.hasOwnProperty.call(config, key));
  if (presentForbidden.length > 0) {
    throw new Error(`Config file must not contain sensitive fields: ${presentForbidden.join(', ')}`);
  }
  const unknown = Object.keys(config).filter((key) => ![
    'base_url',
    'baseUrl',
    'api_key_env',
    'apiKeyEnv',
    'model',
    'repeat',
    'stream',
    'timeout_ms',
    'timeoutMs',
    'out'
  ].includes(key));
  if (unknown.length > 0) {
    throw new Error(`Unknown config fields: ${unknown.join(', ')}`);
  }
  const normalized: Partial<CliArgs> = {};
  if (config.base_url ?? config.baseUrl) normalized.baseUrl = config.base_url ?? config.baseUrl;
  if (config.api_key_env ?? config.apiKeyEnv) normalized.apiKeyEnv = config.api_key_env ?? config.apiKeyEnv;
  if (config.model) normalized.model = config.model;
  if (config.repeat !== undefined) normalized.repeat = parseInteger(String(config.repeat), 'config.repeat', 1, 20);
  if (config.stream !== undefined) normalized.stream = Boolean(config.stream);
  if (config.timeout_ms ?? config.timeoutMs) normalized.timeoutMs = parseInteger(String(config.timeout_ms ?? config.timeoutMs), 'config.timeout_ms', 1000, 300000);
  if (config.out) normalized.out = String(config.out).replace(/\.(json|md)$/i, '');
  return normalized;
}

function mergeConfig(defaultsAndCli: CliArgs, config: Partial<CliArgs>, argv: string[]): CliArgs {
  const merged = { ...defaultsAndCli, ...config };
  const cliOnlyFlags = new Set(['--base-url', '--api-key-env', '--model', '--repeat', '--timeout-ms', '--out']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--stream') merged.stream = defaultsAndCli.stream;
    if (arg === '--non-stream') merged.stream = defaultsAndCli.stream;
    if (arg === '--dry-run') merged.dryRun = true;
    if (cliOnlyFlags.has(arg)) {
      const value = argv[i + 1];
      if (arg === '--base-url') merged.baseUrl = value;
      else if (arg === '--api-key-env') merged.apiKeyEnv = value;
      else if (arg === '--model') merged.model = value;
      else if (arg === '--repeat') merged.repeat = defaultsAndCli.repeat;
      else if (arg === '--timeout-ms') merged.timeoutMs = defaultsAndCli.timeoutMs;
      else if (arg === '--out') merged.out = defaultsAndCli.out;
      i += 1;
    } else if (arg === '--prompt' || arg === '--config') {
      i += 1;
    }
  }
  return merged;
}

function parseInteger(value: string, name: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function helpText(): string {
  return `llm-gateway-audit v0.1.2

Audit an OpenAI-compatible /v1/chat/completions gateway for suspicious transparency gaps.

Usage:
  llm-gateway-audit --base-url <url> --model <model> [options]

Options:
  --base-url <url>       Gateway base URL, for example https://example.com
  --api-key-env <name>   Environment variable containing the API key (default: OPENAI_API_KEY)
  --config <path>        Safe JSON config file. Defaults to llm-gateway-audit.config.json when present.
  --model <model>        Requested model name
  --prompt <text>        Test prompt. The report stores only redacted metadata.
  --repeat <n>           Number of calls, 1-20 (default: 1)
  --stream               Use stream mode
  --non-stream           Use non-stream mode (default)
  --timeout-ms <n>       Request timeout, 1000-300000 (default: 60000)
  --out <path>           Output path without extension (default: reports/audit-<timestamp>)
  --dry-run              Print the redacted request plan without sending a request.
  --help                 Show help

Boundary:
  Reports contain evidence, suspicious score, and transparency risks. They cannot definitively prove the real model identity.
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsedArgs = parseArgs(argv);
  if (parsedArgs.help) {
    console.log(helpText());
    return;
  }
  const config = await loadConfig(parsedArgs.config);
  const args = mergeConfig(parsedArgs, config, argv);
  if (!args.baseUrl) throw new Error('--base-url is required');
  if (!args.model) throw new Error('--model is required');
  if (args.dryRun) {
    const url = redactUrl(args.baseUrl);
    const endpoint = url.redacted === '[invalid-url]'
      ? '[invalid-url]'
      : new URL('/v1/chat/completions', url.redacted.endsWith('/') ? url.redacted : `${url.redacted}/`).toString();
    console.log(JSON.stringify({
      mode: 'dry-run',
      requestSent: false,
      endpoint,
      baseUrl: url.redacted,
      apiKeyEnv: args.apiKeyEnv,
      apiKeyEnvPresent: Boolean(process.env[args.apiKeyEnv]),
      model: args.model,
      stream: args.stream,
      repeat: args.repeat,
      timeoutMs: args.timeoutMs,
      promptStored: false,
      promptLength: args.prompt.length
    }, null, 2));
    return;
  }
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
