import { loadGroups, pickTargetLanguages, scopeGroupsForWrite } from './shared.js';
import { sortAll } from '../core/sorter.js';
import { writeJson } from '../utils/json-io.js';
import { printSortReport, printParseErrors } from '../utils/reporter.js';
import { color, confirm } from '../utils/ui.js';

export async function sortCommand(opts) {
  const indent = parseInt(opts.indent ?? '2', 10);
  const { scan } = loadGroups(opts);
  const targetLangs = await pickTargetLanguages(scan, opts);
  const groups = scopeGroupsForWrite(scan.groups, targetLangs);

  const result = sortAll(groups, indent);
  printSortReport(result, { dryRun: opts.dryRun });
  if (scan.errors.length) printParseErrors(scan.errors);

  if (result.changedCount === 0) return;

  if (opts.dryRun) {
    console.log(color.dim('\n  ▣ 试运行模式：未写入任何文件。'));
    return;
  }

  if (opts.interactive !== false) {
    const ok = await confirm(`确认对 ${result.changedCount} 个文件重排序并写入？`);
    if (!ok) {
      console.log(color.warn('  已取消，未写入文件。'));
      return;
    }
  }

  let written = 0;
  for (const r of result.results) {
    if (r.changed && r.sorted) {
      writeJson(r.file.path, r.sorted, indent);
      written++;
    }
  }
  console.log(color.success(`\n  ✓ 已写入 ${written} 个文件。`));
}
