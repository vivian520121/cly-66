import fs from 'node:fs';
import path from 'node:path';
import { loadGroups, pickTargetLanguages, scopeGroupsForCompare } from './shared.js';
import { diffAll } from '../core/differ.js';
import { exportCsv, buildDiffRows } from '../core/csv-exporter.js';
import { printDiffReport } from '../utils/reporter.js';
import { color } from '../utils/ui.js';

export async function exportCommand(opts) {
  const { scan } = loadGroups(opts);
  const targetLangs = await pickTargetLanguages(scan, opts);
  const groups = scopeGroupsForCompare(scan.groups, targetLangs, opts.ref);
  const result = diffAll(groups, opts.ref);

  if (opts.print) {
    printDiffReport(result, { dryRun: true });
    console.log();
  }

  const types = opts.types
    ? opts.types.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const csv = exportCsv(result.diffs, { types });
  const rowCount = buildDiffRows(result.diffs, { types }).length;
  const out = opts.out || 'i18n-missing.csv';

  if (rowCount === 0) {
    console.log(color.success('  ✓ 未发现缺失/多余/不一致记录，无需导出 CSV。'));
    return;
  }

  // 写入 UTF-8 BOM，确保 Excel 正确识别中文
  fs.writeFileSync(out, '\ufeff' + csv, 'utf8');
  console.log(
    color.success(`  ✓ 已导出 ${rowCount} 条记录 → ${path.resolve(out)}`)
  );
  console.log(color.dim(`    缺失 ${result.totals.missing} · 多余 ${result.totals.extra} · 不一致 ${result.totals.inconsistent}`));

  if (opts.strict && (rowCount > 0 || scan.errors.length)) {
    process.exitCode = 1;
  }
}
