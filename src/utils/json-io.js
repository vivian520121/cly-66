import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * 自定义 JSON 解析错误，附带文件、行号与上下文片段，
 * 便于全局捕获后向用户输出彩色诊断信息而不中断整个流程。
 */
export class JsonParseError extends Error {
  constructor(file, message, line, snippet) {
    super(`JSON 解析失败 [${file}]: ${message}`);
    this.name = 'JsonParseError';
    this.file = file;
    this.line = line;
    this.snippet = snippet;
  }
}

/**
 * 从 JSON.parse 错误信息中提取出错位置并截取上下文片段。
 */
function buildSnippet(raw, errMessage) {
  const m = /position (\d+)/.exec(errMessage);
  if (!m) {
    return { line: 1, snippet: raw.slice(0, 120) };
  }
  const pos = parseInt(m[1], 10);
  const before = raw.slice(0, pos);
  const lineNo = before.split('\n').length;
  const start = Math.max(0, pos - 30);
  const end = Math.min(raw.length, pos + 30);
  const snippet =
    (start > 0 ? '…' : '') +
    raw.slice(start, pos) +
    '▶' +
    raw.slice(pos, end) +
    (end < raw.length ? '…' : '');
  return { line: lineNo, snippet: snippet.replace(/\n/g, '\\n') };
}

/**
 * 读取并解析 JSON 文件，失败时抛出 JsonParseError。
 */
export function readJson(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new JsonParseError(file, `无法读取文件: ${e.code || e.message}`, 0, '');
  }
  // 去掉 BOM，避免带签名文件解析失败
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const { line, snippet } = buildSnippet(raw, e.message);
    throw new JsonParseError(file, e.message, line, snippet);
  }
}

/**
 * 序列化 JSON（保持键序、统一缩进、结尾换行）。
 */
export function stringifyJson(data, indent = 2) {
  return JSON.stringify(data, null, indent) + os.EOL;
}

/**
 * 写入 JSON 文件（自动创建父目录）。
 */
export function writeJson(file, data, indent = 2) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, stringifyJson(data, indent), 'utf8');
}

/**
 * 读取文件并返回原始文本（用于检测键序是否需要重排、统计字节数等）。
 */
export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}
