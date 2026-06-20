import { loadGroups } from './shared.js';
import { printScanReport } from '../utils/reporter.js';
import { color } from '../utils/ui.js';

export async function scanCommand(opts) {
  const { root, scan } = loadGroups(opts);
  printScanReport(scan, root);
  if (!scan.groups.length) {
    console.log(
      color.warn(
        '\n  未发现任何语言包文件。请检查 --dir 目录与 --pattern 语言包目录名。'
      )
    );
    console.log(color.dim('  默认识别目录名: lang, locales, locale, i18n, translations, messages'));
  }
}
