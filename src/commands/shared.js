import path from 'node:path';
import fs from 'node:fs';
import {
  scanLocaleFiles,
  collectLanguages,
  parseLangDirs,
} from '../core/scanner.js';
import { selectMany } from '../utils/ui.js';
import { pickReference } from '../core/differ.js';

export function resolveRoot(dir) {
  const root = path.resolve(dir || process.cwd());
  if (!fs.existsSync(root)) {
    throw new Error(`目录不存在: ${root}`);
  }
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) {
    throw new Error(`目标路径不是目录: ${root}`);
  }
  return root;
}

/**
 * 执行扫描，返回根目录与扫描结果。
 */
export function loadGroups(opts = {}) {
  const root = resolveRoot(opts.dir);
  const langDirs = parseLangDirs(opts.pattern);
  const scan = scanLocaleFiles(root, {
    langDirs,
    ignore: opts.ignore,
    showProgress: opts.progress !== false,
  });
  return { root, scan, langDirs };
}

/**
 * 交互式选择需要同步的目标语言包（参考语言仅作翻译来源，自动排除在选择之外）。
 * 非交互模式或无可选语言时返回 null，表示处理全部非参考语言。
 * @returns {Promise<Set<string>|null>}
 */
export async function pickTargetLanguages(scan, opts = {}) {
  const allLangs = collectLanguages(scan.groups);
  if (allLangs.length <= 1) return null;
  if (opts.noInteractive || opts.interactive === false) return null;
  // 推断可能的参考语言，在选择列表中标注
  const choices = allLangs.map((l) => {
    const isLikelyRef = allLangs.indexOf(l) === 0;
    return {
      value: l,
      label: isLikelyRef ? `${l}（语言包）` : l,
      checked: true,
    };
  });
  const selected = await selectMany(
    choices,
    '选择需要同步的语言包（参考语言将自动用作翻译来源，可多选）'
  );
  return new Set(selected);
}

/**
 * 返回过滤后的分组：保留目标语言 + 参考语言文件，
 * 用于 diff/export 等需要参考语言参与对比的场景。
 */
export function scopeGroupsForCompare(groups, targetLangs, refLang) {
  if (!targetLangs) return groups;
  return groups
    .map((g) => {
      const ref = pickReference(g, refLang);
      const refLangCode = ref ? ref.lang : null;
      const files = g.files.filter(
        (f) => targetLangs.has(f.lang) || f.lang === refLangCode
      );
      return { ...g, files };
    })
    .filter((g) => g.files.length > 0);
}

/**
 * 返回仅包含目标语言的分组，用于 sort 等只写目标文件的场景。
 */
export function scopeGroupsForWrite(groups, targetLangs) {
  if (!targetLangs) return groups;
  return groups
    .map((g) => ({ ...g, files: g.files.filter((f) => targetLangs.has(f.lang)) }))
    .filter((g) => g.files.length > 0);
}
