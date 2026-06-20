import path from 'node:path';
import { color, divider, sectionHeader, banner } from './ui.js';
import { REASON_LABEL, hasDiff } from '../core/differ.js';

function preview(v, len = 48) {
  if (v === undefined || v === null) return color.muted('(空)');
  let s;
  if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  if (s.length > len) s = s.slice(0, len - 1) + '…';
  return s;
}

export function summaryBox(title, lines) {
  const rows = lines.map(([k, v]) => `${k}: ${v}`);
  const width = Math.max(title.length + 4, ...rows.map((r) => r.length)) + 2;
  const top = color.info('┌' + '─'.repeat(width) + '┐');
  const mid = color.info('│') + ' ' + color.lang(title) + ' '.repeat(Math.max(0, width - title.length - 1)) + color.info('│');
  const sep = color.info('├' + '─'.repeat(width) + '┤');
  const body = rows
    .map((r) => color.info('│') + ' ' + r + ' '.repeat(Math.max(0, width - r.length - 1)) + color.info('│'))
    .join('\n');
  const bot = color.info('└' + '─'.repeat(width) + '┘');
  return [top, mid, sep, body, bot].join('\n');
}

export function printParseErrors(errors) {
  if (!errors.length) return;
  console.log('\n' + sectionHeader('JSON 解析错误（已全局捕获，不中断流程）'));
  for (const e of errors) {
    console.log(color.error(`  ✗ ${e.file}`));
    if (e.line) console.log(color.dim(`      位置: 第 ${e.line} 行`));
    console.log(color.warn(`      原因: ${e.message}`));
    if (e.snippet) console.log(color.dim(`      片段: ${e.snippet}`));
  }
  console.log(color.error(`\n  ⚠ 共 ${errors.length} 个文件解析失败，处理时已自动跳过。`));
}

export function printScanReport(scanResult, rootDir) {
  const { groups, errors, totalFiles, totalKeys } = scanResult;
  console.log(banner('扫描结果 · SCAN'));
  console.log(color.dim(`  根目录: ${rootDir}`));
  console.log(color.dim(`  语言包分组: ${groups.length}  |  文件: ${totalFiles}  |  叶子键总数: ${totalKeys}\n`));

  for (const g of groups) {
    console.log(`  ${color.badge(g.relDir)}  ${color.dim('(' + g.dir + ')')}`);
    for (const f of g.files) {
      const tag = f.parseError
        ? color.error('解析失败')
        : color.success(`${f.keys.size} 键`);
      console.log(
        `    ${color.lang(f.lang.padEnd(8))} ${path.basename(f.path)}  ${tag}`
      );
    }
    console.log();
  }
  if (errors.length) printParseErrors(errors);
  console.log(summaryBox('汇总', [
    ['分组数', groups.length],
    ['语言包文件', totalFiles],
    ['叶子键总数', totalKeys],
    ['解析错误', errors.length],
  ]));
}

export function printDiffReport(diffResult, opts = {}) {
  const { diffs, totals } = diffResult;
  const { dryRun = false } = opts;

  console.log(banner(dryRun ? '差异对比 · DIFF (DRY-RUN)' : '差异对比 · DIFF'));
  if (dryRun) {
    console.log(color.warn('  ▣ 试运行模式：仅打印差异日志，不会修改任何源文件\n'));
  }

  let cleanGroups = 0;
  for (const d of diffs) {
    const problematic = d.files.some(
      (f) => f.missing.length || f.extra.length || f.inconsistent.length || f.parseError
    );
    if (!problematic) {
      cleanGroups++;
      continue;
    }
    const refName = d.reference ? d.reference.lang : color.muted('无');
    console.log(`  ${sectionHeader(d.group.relDir)}  参考语言: ${color.lang(refName)}`);

    d.files.forEach((f, idx) => {
      const last = idx === d.files.length - 1;
      const branch = last ? '└─' : '├─';
      if (f.parseError) {
        console.log(`  ${branch} ${color.lang(f.lang.padEnd(8))} ${color.error('解析失败，已跳过')}`);
        return;
      }
      const total = f.missing.length + f.extra.length + f.inconsistent.length;
      if (total === 0) {
        console.log(`  ${branch} ${color.lang(f.lang.padEnd(8))} ${path.basename(f.path)}  ${color.success('✓ 一致')}`);
        return;
      }
      const parts = [];
      if (f.missing.length) parts.push(color.missing(`缺失 ${f.missing.length}`));
      if (f.extra.length) parts.push(color.extra(`多余 ${f.extra.length}`));
      if (f.inconsistent.length) parts.push(color.inconsistent(`不一致 ${f.inconsistent.length}`));
      console.log(`  ${branch} ${color.lang(f.lang.padEnd(8))} ${path.basename(f.path)}  ${parts.join('  ')}`);

      if (f.missing.length) {
        const keys = f.missing.map((m) => color.missing(m.key)).join(', ');
        console.log(`       ${color.missing('✗ 缺失')}: ${keys}`);
      }
      if (f.extra.length) {
        const keys = f.extra.map((e) => color.extra(e.key)).join(', ');
        console.log(`       ${color.extra('✗ 多余')}: ${keys}`);
      }
      if (f.inconsistent.length) {
        for (const inc of f.inconsistent) {
          const reason = color.inconsistent(`[${REASON_LABEL[inc.reason] || inc.reason}]`);
          console.log(
            `       ${color.inconsistent('✗ 不一致')}: ${color.inconsistent(inc.key)} ${reason}`
          );
          console.log(
            color.dim(`            参考: ${preview(inc.refValue)}  →  当前: ${preview(inc.value)}`)
          );
        }
      }
    });
    console.log();
  }

  console.log(divider());
  console.log(
    summaryBox('差异汇总', [
      ['语言包分组', totals.groups],
      ['已一致分组', cleanGroups],
      ['存在差异分组', totals.groups - cleanGroups],
      ['缺失键', totals.missing],
      ['多余键', totals.extra],
      ['不一致键', totals.inconsistent],
      ['解析错误文件', totals.parseErrors],
    ])
  );
}

export function printFillReport(fillResult, opts = {}) {
  const { results, totalFilled } = fillResult;
  const { dryRun = false } = opts;
  console.log(banner(dryRun ? '填充缺失翻译 · FILL (DRY-RUN)' : '填充缺失翻译 · FILL'));
  if (dryRun) {
    console.log(color.warn('  ▣ 试运行模式：仅预览将要填充的内容，不会写入文件\n'));
  }
  if (totalFilled === 0) {
    console.log(color.success('  ✓ 未发现缺失键，无需填充。'));
    return;
  }
  for (const r of results) {
    console.log(`  ${sectionHeader(r.group.relDir)}  参考语言: ${color.lang(r.refLang)}`);
    const byFile = new Map();
    for (const c of r.changes) {
      if (!byFile.has(c.path)) byFile.set(c.path, { lang: c.lang, items: [] });
      byFile.get(c.path).items.push(c);
    }
    for (const [p, info] of byFile) {
      console.log(`    ${color.lang(info.lang.padEnd(8))} ${path.basename(p)}`);
      for (const c of info.items) {
        const kind = c.kind === 'empty' ? color.warn('补空') : color.missing('补缺');
        console.log(`      ${kind} ${color.key(c.key)} ${color.dim('→')} ${preview(c.value)}`);
      }
    }
    console.log();
  }
  console.log(divider());
  console.log(color.success(`  共将填充 ${totalFilled} 个键。`));
}

export function printSortReport(sortResult, opts = {}) {
  const { results, changedCount, skipped, total } = sortResult;
  const { dryRun = false } = opts;
  console.log(banner(dryRun ? '整理排序 · SORT (DRY-RUN)' : '整理排序 · SORT'));
  if (dryRun) {
    console.log(color.warn('  ▣ 试运行模式：仅预览键序变化，不会写入文件\n'));
  }
  let clean = 0;
  for (const r of results) {
    const p = path.basename(r.file.path);
    const rel = r.group.relDir;
    if (r.file.parseError || r.file.data === null) {
      console.log(`  ${color.error('✗')} ${color.lang(r.file.lang)} ${rel}/${p}  解析失败，已跳过`);
      continue;
    }
    if (r.changed) {
      console.log(`  ${color.warn('↕')} ${color.lang(r.file.lang)} ${rel}/${p}  ${color.warn('键序/格式需要整理')}`);
    } else {
      clean++;
      console.log(`  ${color.success('✓')} ${color.lang(r.file.lang)} ${rel}/${p}  ${color.dim('已规范')}`);
    }
  }
  console.log();
  console.log(divider());
  console.log(summaryBox('排序汇总', [
    ['总文件数', total],
    ['已规范', clean],
    ['需整理', changedCount],
    ['跳过(解析失败)', skipped],
  ]));
}
