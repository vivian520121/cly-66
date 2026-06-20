import { loadGroups, pickTargetLanguages, scopeGroupsForCompare } from './shared.js';
import { diffAll } from '../core/differ.js';
import { printDiffReport } from '../utils/reporter.js';

export async function diffCommand(opts) {
  const { scan } = loadGroups(opts);
  const targetLangs = await pickTargetLanguages(scan, opts);
  const groups = scopeGroupsForCompare(scan.groups, targetLangs, opts.ref);
  const result = diffAll(groups, opts.ref);
  printDiffReport(result, { dryRun: opts.dryRun });

  if (opts.strict) {
    const diffs =
      result.totals.missing + result.totals.extra + result.totals.inconsistent;
    if (diffs > 0 || scan.errors.length) process.exitCode = 1;
  }
}
