// 嵌套 JSON 键的工具函数：扁平化、按点号路径取值/赋值、占位符提取。

/**
 * 将嵌套对象扁平化为叶子路径数组。
 * 仅对象会继续下钻，数组与原始值视为叶子。
 * @returns {Array<{key:string, value:any}>}
 */
export function flattenKeys(obj, prefix = '') {
  const out = [];
  if (
    obj === null ||
    typeof obj !== 'object' ||
    Array.isArray(obj)
  ) {
    if (prefix) out.push({ key: prefix, value: obj });
    return out;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0 && prefix) {
    out.push({ key: prefix, value: obj });
    return out;
  }
  for (const k of keys) {
    const next = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length > 0
    ) {
      out.push(...flattenKeys(v, next));
    } else {
      out.push({ key: next, value: v });
    }
  }
  return out;
}

export function keySet(obj) {
  return new Set(flattenKeys(obj).map((e) => e.key));
}

export function getNestedValue(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

export function setNestedValue(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = cur[p];
    if (
      next === undefined ||
      next === null ||
      typeof next !== 'object' ||
      Array.isArray(next)
    ) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

export function deleteNestedValue(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
      return false;
    }
    cur = cur[p];
  }
  return delete cur[parts[parts.length - 1]];
}

/**
 * 提取 ICU 风格占位符 {name} / {{name}}，用于跨语言一致性校验。
 */
export function extractPlaceholders(value) {
  if (typeof value !== 'string') return [];
  const set = new Set();
  const re = /\{\{?\s*([\w.-]+)\s*\}?\}/g;
  let m;
  while ((m = re.exec(value)) !== null) {
    set.add(m[1]);
  }
  return [...set].sort();
}
