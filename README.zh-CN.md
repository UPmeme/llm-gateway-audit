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

stream 模式：

```bash
node ./dist/cli.js --base-url "https://gateway.example.com" --model "gpt-4.1-mini" --stream
```

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
npm test
```

测试只使用本地 mock gateway。
