import { Command } from 'commander';
import chalk from 'chalk';
import { scanCommand } from './commands/scan.js';
import { diffCommand } from './commands/diff.js';
import { fillCommand } from './commands/fill.js';
import { sortCommand } from './commands/sort.js';
import { exportCommand } from './commands/export.js';

/**
 * 为子命令注入通用全局选项。
 */
function withCommon(cmd) {
  return cmd
    .option('-d, --dir <path>', '项目根目录（默认当前目录）', '.')
    .option(
      '-p, --pattern <dirs>',
      '语言包目录名，逗号分隔（默认 lang,locales,locale,i18n,translations,messages）'
    )
    .option('--dry-run', '试运行模式：仅打印差异日志，不修改源文件')
    .option(
      '-n, --no-interactive',
      '跳过交互式选择，直接处理全部语言包'
    )
    .option('--no-progress', '隐藏文件解析进度条')
    .option('--ignore <names>', '额外忽略的目录名，逗号分隔（默认已忽略 node_modules 等）')
    .option('--ref <lang>', '指定参考语言代码（默认自动选择 zh>en>ja>...）')
    .option('--indent <n>', 'JSON 缩进空格数', '2');
}

const program = new Command();

program
  .name('i18n-cli')
  .description(
    '纯本地前端国际化文本处理 CLI —— 离线解析项目 JSON 语言包\n' +
      '支持 scan/diff/fill/sort/export，dry-run 彩色高亮，全程不联网。'
  )
  .version('1.0.0', '-v, --version')
  .helpOption('-h, --help', '显示帮助');

withCommon(program.command('scan'))
  .description('递归扫描项目所有 lang/*.json 多语言文件并统计键数')
  .action(async (opts) => {
    await scanCommand(opts);
  });

withCommon(program.command('diff'))
  .description('对比各语言包缺失/多余/不一致的翻译键')
  .option('--strict', '发现差异时以非零状态码退出（用于 CI 门禁）')
  .action(async (opts) => {
    await diffCommand(opts);
  });

withCommon(program.command('fill'))
  .description('批量给缺失键填充占位翻译文案')
  .option(
    '--default <text>',
    '自定义默认填充文案，支持 {key}/{lang}/{refLang}/{refValue} 占位符',
    '[待翻译]{key}'
  )
  .option('--fill-empty', '同时填充空值与疑似未翻译（值等于键）的条目')
  .action(async (opts) => {
    await fillCommand(opts);
  });

withCommon(program.command('sort'))
  .description('统一排序所有 JSON 键名并格式化缩进')
  .action(async (opts) => {
    await sortCommand(opts);
  });

withCommon(program.command('export'))
  .description('导出缺失翻译清单为 CSV，方便人工校对')
  .option('-o, --out <file>', '输出 CSV 文件路径', 'i18n-missing.csv')
  .option(
    '--types <list>',
    '导出类型，逗号分隔（missing,extra,inconsistent），默认全部'
  )
  .option('--print', '同时在终端打印差异报告')
  .option('--strict', '发现差异时以非零状态码退出')
  .action(async (opts) => {
    await exportCommand(opts);
  });

program.addHelpText(
  'after',
  `\n${chalk.hex('#7aa2f7')('使用示例:')}${[
    `  i18n-cli scan --dir ./src                       # 扫描 src 下语言包`,
    `  i18n-cli diff --dir ./src --dry-run             # 试运行对比（彩色高亮，不改动文件）`,
    `  i18n-cli diff --dir ./src --ref en --strict     # 以 en 为参考对比，差异时退出码 1`,
    `  i18n-cli fill --dir ./src --default "待翻译:{key}"`,
    `  i18n-cli fill --dir ./src --fill-empty          # 同时补全空值/未翻译`,
    `  i18n-cli sort --dir ./src --indent 2            # 排序键名并格式化`,
    `  i18n-cli export --dir ./src --out missing.csv --types missing,inconsistent`,
    `  i18n-cli scan -n --no-progress                  # 非交互、无进度条（适合脚本）`,
  ]
    .map((l) => chalk.dim(l))
    .join('\n')}\n\n${chalk.dim(
    '说明：所有操作均离线进行，不发起任何网络请求。JSON 解析错误会被全局捕获并跳过，不会中断整体流程。'
  )}`
);

export async function run() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(chalk.red(`\n  ✗ 执行出错: ${err.message}`));
    if (process.env.I18N_DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error(chalk.red(`\n  ✗ 未捕获异常: ${err.message}`));
  if (process.env.I18N_DEBUG) console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  const msg = err && err.message ? err.message : String(err);
  console.error(chalk.red(`\n  ✗ 未处理的 Promise 拒绝: ${msg}`));
  process.exit(1);
});
