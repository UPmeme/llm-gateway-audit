# llm-gateway-audit

`llm-gateway-audit` 是一个开源 CLI，用来审计 OpenAI-compatible LLM gateway / token 中转站是否存在可疑透明度问题。

它会收集 redacted 证据，包括模型字段、usage/token 统计、latency、stream 结构、request id、`system_fingerprint` 和 `base_url` 风险。它不能绝对证明真实模型身份。

## 安装与运行

```bash
git clone https://github.com/UPmeme/llm-gateway-audit.git
cd llm-gateway-audit
node ./dist/cli.js --help
```

需要 Node.js 20 或更新版本。

## 构建

```bash
npm install
npm run build
```

## 示例

```bash
export OPENAI_API_KEY="sk-..."
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt "Say hello in one short sentence." \
  --repeat 3 \
  --non-stream \
  --out reports/example
```

从本地文件读取 prompt：

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt-file ./prompt.txt
```

报告不会保存 prompt 文件路径或原始 prompt 内容。

stream 模式：

```bash
node ./dist/cli.js --base-url "https://gateway.example.com" --model "gpt-4.1-mini" --stream
```

dry-run，不发送真实请求：

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --dry-run
```

## 配置文件

可以用安全 JSON 配置文件保存非敏感参数：

```bash
cp llm-gateway-audit.config.example.json llm-gateway-audit.config.json
node ./dist/cli.js --config llm-gateway-audit.config.json --prompt "Say hello."
```

配置文件可以包含 `base_url`、`api_key_env`、`model`、`repeat`、`stream`、`timeout_ms` 和 `out`。

配置文件不能包含真实 API key、prompt、token、messages 或 authorization header。CLI 会拒绝 `api_key`、`prompt`、`token`、`messages` 等敏感字段。

## 首版检查项

- 请求模型与响应 `model` 是否一致
- `usage` 是否存在
- `prompt_tokens` / `completion_tokens` / `total_tokens` 是否合理
- latency
- response `id`
- `system_fingerprint`
- stream chunk 基本结构
- request id / 透明度 header
- `base_url` 隐私与安全风险
- suspicious score

## 评分

suspicious score 是基于证据的保守评分。每次 run 会累加 finding score，单次最高封顶 100；报告摘要使用所有 run 中最高的分数。

| Signal | Score |
| --- | ---: |
| 响应 model 与请求 model 不一致 | 30 |
| `base_url` 无效或包含账号密码 | 30 |
| stream chunk malformed 或没有有效 chunk | 25 |
| non-stream 响应缺少 `usage` | 20 |
| 远程 `base_url` 未使用 HTTPS | 20 |
| 缺少响应 `model` 或 token 统计异常 | 15 |
| 缺少 response id 或 URL query 参数有风险 | 10 |
| 缺少 request id header、`system_fingerprint` 等透明度信息 | 5 |

每个 finding 会包含 risk reason、recommended action 和 false-positive notes。

## 示例报告

redacted 示例在 [`examples/reports`](examples/reports)：

- honest gateway
- model mismatch
- missing usage
- fake stream

## Finding Schema

finding JSON 使用稳定的 `finding.v1` 结构，包含 `code`、`category`、`severity`、`score`、redacted `evidence`、`riskReason`、`recommendedAction` 和 `falsePositiveNotes`。

见 [`docs/finding-schema.md`](docs/finding-schema.md)。

## 隐私边界

默认输出报告会做 redaction：

- 不保存 API key
- 不保存原始 prompt
- 不保存原始响应 body
- 移除 `base_url` 中的账号密码、query string 和 fragment

公开报告前仍应人工检查是否含有环境特有 metadata。

## 限制

本工具输出的是 audit evidence、suspicious behavior、transparency gaps 和 risk score。它不能绝对证明模型偷换或真实上游模型身份。

## 测试

```bash
npm run verify
```

测试只使用本地 mock gateway。
