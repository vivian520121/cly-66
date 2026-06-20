import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../utils/json-io.js';
import { flattenKeys, keySet } from '../utils/keys.js';
import { runWithProgress } from '../utils/ui.js';

const DEFAULT_LANG_DIRS = [
  'lang',
  'langs',
  'locale',
  'locales',
  'i18n',
  'translations',
  'messages',
];

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  'coverage',
  '.nyc_output',
  '.turbo',
  '.parcel-cache',
  '.vite',
  '.svelte-kit',
  '.idea',
  '.vscode',
]);

/**
 * 解析逗号分隔的语言目录名。
 */
export function parseLangDirs(input) {
  if (!input) return new Set(DEFAULT_LANG_DIRS);
  return new Set(
    input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * 递归遍历目录，收集所有 .json 文件（跳过忽略目录与符号链接目录）。
 */
function walk(root, ignoreNames) {
  const results = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ignoreNames.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.isSymbolicLink()) continue;
        stack.push(full);
      } else if (ent.isFile() && ent.name.endsWith('.json')) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * 判定一个 json 文件是否属于语言包目录，并返回其语言信息。
 * 规则：向上寻找最近的祖先目录名 ∈ langDirs，按该目录分组；
 * 语言码取该目录之下的第一段路径（扁平文件去掉 .json 后缀）。
 */
function matchLocale(file, root, langDirs) {
  const rel = path.relative(root, file);
  const segs = rel.split(path.sep);
  let idx = -1;
  for (let i = segs.length - 2; i >= 0; i--) {
    if (langDirs.has(segs[i])) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return null;
  const localeRelDir = segs.slice(0, idx + 1).join(path.sep);
  const localeDirAbs = path.join(root, localeRelDir);
  const relFromLocale = segs.slice(idx + 1).join(path.sep);
  const parts = relFromLocale.split(path.sep);
  const lang =
    parts.length === 1 ? path.basename(parts[0], '.json') : parts[0];
  return { localeDirAbs, localeRelDir, lang };
}

/**
 * 扫描并解析所有语言包文件，返回分组结果与解析错误列表。
 * @param {string} rootDir 项目根目录
 * @param {{langDirs?:Set, ignore?:string[], showProgress?:boolean}} options
 * @returns {{groups: Array, errors: Array, totalFiles: number, totalKeys: number}}
 */
export function scanLocaleFiles(rootDir, options = {}) {
  const langDirs =
    options.langDirs || new Set(DEFAULT_LANG_DIRS);
  const ignoreNames = new Set(DEFAULT_IGNORE);
  (options.ignore || []).forEach((n) => ignoreNames.add(n));

  const allJson = walk(rootDir, ignoreNames);
  const candidates = [];
  for (const file of allJson) {
    const info = matchLocale(file, rootDir, langDirs);
    if (info) candidates.push({ file, ...info });
  }

  // 按语言包目录分组
  const groupMap = new Map();
  for (const c of candidates) {
    if (!groupMap.has(c.localeDirAbs)) {
      groupMap.set(c.localeDirAbs, {
        dir: c.localeDirAbs,
        relDir: c.localeRelDir,
        files: [],
      });
    }
    groupMap.get(c.localeDirAbs).files.push({
      lang: c.lang,
      path: c.file,
      data: null,
      keys: new Set(),
      parseError: null,
    });
  }
  const groups = [...groupMap.values()];

  // 带进度条地解析每个文件
  const parseItems = groups.flatMap((g) =>
    g.files.map((f) => ({ path: f.path, label: `${g.relDir}/${path.basename(f.path)}`, group: g, file: f }))
  );
  const errors = [];
  runWithProgress(
    parseItems,
    '解析语言包',
    (item) => {
      try {
        const data = readJson(item.path);
        item.file.data = data;
        item.file.keys = keySet(data);
      } catch (e) {
        item.file.data = null;
        item.file.keys = new Set();
        item.file.parseError = e;
        errors.push(e);
      }
    },
    options.showProgress !== false && parseItems.length > 0
  );

  let totalKeys = 0;
  for (const g of groups) {
    for (const f of g.files) totalKeys += f.keys.size;
  }

  return { groups, errors, totalFiles: parseItems.length, totalKeys };
}

/**
 * 收集所有文件中出现过的语言码（去重，排序），用于交互式选择。
 */
export function collectLanguages(groups) {
  const set = new Set();
  for (const g of groups) for (const f of g.files) set.add(f.lang);
  return [...set].sort();
}

/**
 * 收集所有文件中出现过的语言包目录（去重，排序），用于交互式选择同步范围。
 */
export function collectGroups(groups) {
  return groups
    .map((g) => ({ value: g.dir, label: g.relDir, files: g.files.length }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
