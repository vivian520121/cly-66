import { setNestedValue, getNestedValue } from '../utils/keys.js';
import { pickReference } from './differ.js';

export const DEFAULT_FILL_TEXT = '[待翻译]{key}';

/**
 * 渲染填充文案模板，支持 {key} {lang} {refLang} {refValue} 占位符。
 */
export function renderFill(template, ctx) {
  return String(template)
    .replaceAll('{key}', ctx.key ?? '')
    .replaceAll('{lang}', ctx.lang ?? '')
    .replaceAll('{refLang}', ctx.refLang ?? '')
    .replaceAll('{refValue}', ctx.refValue === undefined ? '' : String(ctx.refValue));
}

/**
 * 为单个语言包分组批量填充缺失的翻译键。
 * @param {object} group 扫描得到的语言包分组
 * @param {{fillText?:string, refLang?:string, fillEmpty?:boolean, targetLangs?:Set|null}} options
 * @returns {{changes:Array, refLang:string|null}}
 */
export function fillGroup(group, options = {}) {
  const fillText = options.fillText ?? DEFAULT_FILL_TEXT;
  const fillEmpty = options.fillEmpty === true;
  const targetLangs = options.targetLangs ?? null;
  const ref = pickReference(group, options.refLang);
  if (!ref || ref.data === null) {
    return { changes: [], refLang: ref ? ref.lang : null };
  }
  const refData = ref.data;
  const refLang = ref.lang;
  const changes = [];

  for (const f of group.files) {
    if (f.parseError || f.data === null) continue;
    const isRef = f === ref;
    // 参考语言作为翻译来源，不被修改
    if (isRef) continue;
    // 仅处理选定的目标语言（未选定时处理全部非参考语言）
    if (targetLangs && !targetLangs.has(f.lang)) continue;

    for (const refKey of ref.keys) {
      if (!f.keys.has(refKey)) {
        const refValue = getNestedValue(refData, refKey);
        const value = renderFill(fillText, {
          key: refKey,
          lang: f.lang,
          refLang,
          refValue,
        });
        setNestedValue(f.data, refKey, value);
        f.keys.add(refKey);
        changes.push({ path: f.path, lang: f.lang, key: refKey, value, kind: 'missing' });
      } else if (fillEmpty) {
        const cur = getNestedValue(f.data, refKey);
        const looksEmpty =
          cur === '' ||
          cur === null ||
          (typeof cur === 'string' && cur.trim() === refKey);
        if (looksEmpty) {
          const refValue = getNestedValue(refData, refKey);
          const value = renderFill(fillText, {
            key: refKey,
            lang: f.lang,
            refLang,
            refValue,
          });
          setNestedValue(f.data, refKey, value);
          changes.push({ path: f.path, lang: f.lang, key: refKey, value, kind: 'empty' });
        }
      }
    }
  }
  return { changes, refLang };
}

/**
 * 对多个分组执行填充，返回汇总。
 */
export function fillAll(groups, options = {}) {
  const results = [];
  let totalFilled = 0;
  for (const group of groups) {
    const { changes, refLang } = fillGroup(group, options);
    if (changes.length) {
      results.push({ group, refLang, changes });
      totalFilled += changes.length;
    }
  }
  return { results, totalFilled };
}
