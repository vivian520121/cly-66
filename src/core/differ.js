import { getNestedValue, extractPlaceholders } from '../utils/keys.js';

// 参考语言选择优先级：中文系 → 英文系 → 日韩欧 → 首个文件
const REF_PRIORITY = [
  'zh',
  'zh-CN',
  'zh-Hans',
  'zh-TW',
  'en',
  'en-US',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
];

export const REASON_LABEL = {
  empty: '空值',
  sameAsKey: '疑似未翻译(值等于键)',
  typeMismatch: '类型不一致',
  placeholderMismatch: '占位符不一致',
};

/**
 * 为一个语言包分组挑选参考语言文件。
 */
export function pickReference(group, preferLang) {
  const files = group.files.filter((f) => f.data !== null && !f.parseError);
  if (files.length === 0) return null;
  if (preferLang) {
    const hit = files.find((f) => f.lang === preferLang);
    if (hit) return hit;
  }
  for (const p of REF_PRIORITY) {
    const hit = files.find((f) => f.lang === p);
    if (hit) return hit;
  }
  return files[0];
}

/**
 * 判定同一键在参考值与目标值之间是否不一致。
 * @returns {string|null} 不一致原因，null 表示一致
 */
function classify(refValue, targetValue, key, isRef) {
  if (targetValue === undefined) return null;
  if (targetValue === '' || targetValue === null) return 'empty';
  if (typeof targetValue === 'string' && targetValue.trim() === key) {
    return 'sameAsKey';
  }
  if (!isRef) {
    if (typeof refValue !== typeof targetValue) return 'typeMismatch';
    if (typeof refValue === 'string' || typeof targetValue === 'string') {
      const a = extractPlaceholders(refValue);
      const b = extractPlaceholders(targetValue);
      if (a.join('|') !== b.join('|')) return 'placeholderMismatch';
    }
  }
  return null;
}

/**
 * 对单个语言包分组执行差异分析。
 */
export function diffGroup(group, preferLang) {
  const ref = pickReference(group, preferLang);
  const result = {
    group: { dir: group.dir, relDir: group.relDir },
    reference: ref ? { lang: ref.lang, path: ref.path } : null,
    referenceFile: ref,
    unionKeys: [],
    files: [],
  };

  if (!ref) {
    for (const f of group.files) {
      result.files.push({
        lang: f.lang,
        path: f.path,
        missing: [],
        extra: [],
        inconsistent: [],
        parseError: f.parseError,
      });
    }
    return result;
  }

  const refKeys = ref.keys;
  const union = new Set(refKeys);
  for (const f of group.files) for (const k of f.keys) union.add(k);
  result.unionKeys = [...union].sort();

  for (const f of group.files) {
    const entry = {
      lang: f.lang,
      path: f.path,
      missing: [],
      extra: [],
      inconsistent: [],
      parseError: f.parseError,
    };
    if (f.parseError || f.data === null) {
      result.files.push(entry);
      continue;
    }
    const isRef = f === ref;

    for (const k of refKeys) {
      if (!f.keys.has(k)) {
        entry.missing.push({ key: k, refValue: getNestedValue(ref.data, k) });
      }
    }
    for (const k of f.keys) {
      if (!refKeys.has(k)) {
        entry.extra.push({ key: k, value: getNestedValue(f.data, k) });
      }
    }
    for (const k of refKeys) {
      if (!f.keys.has(k)) continue;
      const refValue = getNestedValue(ref.data, k);
      const targetValue = getNestedValue(f.data, k);
      const reason = classify(refValue, targetValue, k, isRef);
      if (reason) {
        entry.inconsistent.push({ key: k, refValue, value: targetValue, reason });
      }
    }

    entry.missing.sort((a, b) => a.key.localeCompare(b.key));
    entry.extra.sort((a, b) => a.key.localeCompare(b.key));
    entry.inconsistent.sort((a, b) => a.key.localeCompare(b.key));
    result.files.push(entry);
  }
  return result;
}

/**
 * 对所有分组执行差异分析并汇总。
 */
export function diffAll(groups, preferLang) {
  const diffs = groups.map((g) => diffGroup(g, preferLang));
  const totals = {
    groups: diffs.length,
    files: 0,
    missing: 0,
    extra: 0,
    inconsistent: 0,
    parseErrors: 0,
  };
  for (const d of diffs) {
    for (const f of d.files) {
      totals.files++;
      totals.missing += f.missing.length;
      totals.extra += f.extra.length;
      totals.inconsistent += f.inconsistent.length;
      if (f.parseError) totals.parseErrors++;
    }
  }
  return { diffs, totals };
}

/**
 * 判断某分组是否存在任何差异。
 */
export function hasDiff(groupDiff) {
  return groupDiff.files.some(
    (f) => f.missing.length || f.extra.length || f.inconsistent.length
  );
}
