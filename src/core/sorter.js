import { stringifyJson } from '../utils/json-io.js';

/**
 * 递归排序对象键名（数组顺序保持不变）。
 * 采用自然序 + 大小写不敏感，便于 a1/a2/a10 这类键名稳定排序。
 */
export function sortObjectDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectDeep);
  }
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    const keys = Object.keys(obj).sort((a, b) =>
      a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
    );
    for (const k of keys) out[k] = sortObjectDeep(obj[k]);
    return out;
  }
  return obj;
}

/**
 * 对单个语言包文件计算排序后的结果与是否发生变化。
 */
export function sortLocaleFile(file, indent = 2) {
  if (file.parseError || file.data === null) {
    return { file, sorted: null, changed: false, before: '', after: '' };
  }
  const sorted = sortObjectDeep(file.data);
  const before = stringifyJson(file.data, indent);
  const after = stringifyJson(sorted, indent);
  return { file, sorted, changed: before !== after, before, after };
}

/**
 * 对所有分组中的文件计算排序结果。
 */
export function sortAll(groups, indent = 2) {
  const results = [];
  let changedCount = 0;
  let skipped = 0;
  for (const group of groups) {
    for (const f of group.files) {
      const r = sortLocaleFile(f, indent);
      results.push({ group, ...r });
      if (f.parseError || f.data === null) skipped++;
      else if (r.changed) changedCount++;
    }
  }
  return { results, changedCount, skipped, total: results.length };
}
