import { loadGroups, pickTargetLanguages } from './shared.js';
import { fillAll, DEFAULT_FILL_TEXT } from '../core/filler.js';
import { writeJson } from '../utils/json-io.js';
import { printFillReport, printParseErrors } from '../utils/reporter.js';
import { color, confirm } from '../utils/ui.js';

export async function fillCommand(opts) {
  const indent = parseInt(opts.indent ?? '2', 10);
  const { scan } = loadGroups(opts);
  const targetLangs = await pickTargetLanguages(scan, opts);
  const fillText = opts.default ?? DEFAULT_FILL_TEXT;

  const fillResult = fillAll(scan.groups, {
    fillText,
    refLang: opts.ref,
    fillEmpty: opts.fillEmpty === true,
    targetLangs,
  });

  printFillReport(fillResult, { dryRun: opts.dryRun });
  if (scan.errors.length) printParseErrors(scan.errors);

  if (fillResult.totalFilled === 0) return;

  if (opts.dryRun) {
    console.log(color.dim('\n  ▣ 试运行模式：未写入任何文件。'));
    return;
  }

  if (opts.interactive !== false) {
    const ok = await confirm(
      `确认将填充 ${fillResult.totalFilled} 个键并写入源文件？`
    );
    if (!ok) {
      console.log(color.warn('  已取消，未写入文件。'));
      return;
    }
  }

  // 收集被修改的文件路径并写回（数据已在 fillAll 中就地更新）
  const changedPaths = new Set();
  for (const r of fillResult.results) {
    for (const c of r.changes) changedPaths.add(c.path);
  }
  let written = 0;
  for (const group of scan.groups) {
    for (const f of group.files) {
      if (changedPaths.has(f.path) && f.data !== null && !f.parseError) {
        writeJson(f.path, f.data, indent);
        written++;
      }
    }
  }
  console.log(color.success(`\n  ✓ 已写入 ${written} 个文件，共填充 ${fillResult.totalFilled} 个键。`));
}
