import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { REASON_LABEL } from './differ.js';

const COLUMNS = [
  '语言包目录',
  '语言',
  '文件',
  '类型',
  '键',
  '参考值',
  '当前值',
  '原因',
];

function toCell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const TYPE_LABEL = {
  missing: '缺失',
  extra: '多余',
  inconsistent: '不一致',
};

/**
 * 将差异结果展开为扁平行记录，便于导出 CSV 或其它处理。
 */
export function buildDiffRows(diffs, options = {}) {
  const typeSet = options.types
    ? new Set(options.types)
    : new Set(['missing', 'extra', 'inconsistent']);
  const rows = [];
  for (const d of diffs) {
    for (const f of d.files) {
      if (f.parseError) continue;
      const dir = d.group.relDir;
      const fileName = path.basename(f.path);
      if (typeSet.has('missing')) {
        for (const m of f.missing) {
          rows.push({
            语言包目录: dir,
            语言: f.lang,
            文件: fileName,
            类型: TYPE_LABEL.missing,
            键: m.key,
            参考值: toCell(m.refValue),
            当前值: '',
            原因: '',
          });
        }
      }
      if (typeSet.has('extra')) {
        for (const e of f.extra) {
          rows.push({
            语言包目录: dir,
            语言: f.lang,
            文件: fileName,
            类型: TYPE_LABEL.extra,
            键: e.key,
            参考值: '',
            当前值: toCell(e.value),
            原因: '',
          });
        }
      }
      if (typeSet.has('inconsistent')) {
        for (const inc of f.inconsistent) {
          rows.push({
            语言包目录: dir,
            语言: f.lang,
            文件: fileName,
            类型: TYPE_LABEL.inconsistent,
            键: inc.key,
            参考值: toCell(inc.refValue),
            当前值: toCell(inc.value),
            原因: REASON_LABEL[inc.reason] || inc.reason,
          });
        }
      }
    }
  }
  return rows;
}

/**
 * 生成缺失翻译清单 CSV 字符串（含表头）。
 */
export function exportCsv(diffs, options = {}) {
  const rows = buildDiffRows(diffs, options);
  if (rows.length === 0) return '';
  return stringify(rows, {
    header: true,
    columns: COLUMNS,
    quoted: true,
    quoted_empty: true,
    eof: true,
  });
}
