import chalk from 'chalk';
import cliProgress from 'cli-progress';
import inquirer from 'inquirer';

// 统一颜色语义：缺失=红、多余=黄、不一致=品红、成功=绿、信息=青
export const color = {
  missing: (s) => chalk.red.bold(s),
  extra: (s) => chalk.yellow(s),
  inconsistent: (s) => chalk.magenta(s),
  success: (s) => chalk.green(s),
  info: (s) => chalk.cyan(s),
  warn: (s) => chalk.yellow(s),
  dim: (s) => chalk.dim(s),
  key: (s) => chalk.blue(s),
  lang: (s) => chalk.cyanBright(s),
  error: (s) => chalk.red(s),
  muted: (s) => chalk.gray(s),
  badge: (s) => chalk.bgHex('#3b3b3b').white.bold(` ${s} `),
};

// 顶部 Banner
export function banner(title) {
  const bar = '═'.repeat(58);
  return [
    chalk.hex('#7aa2f7')(bar),
    chalk.hex('#7aa2f7').bold(`  ${title}`),
    chalk.hex('#7aa2f7')(bar),
  ].join('\n');
}

export function divider(len = 58) {
  return chalk.dim('─'.repeat(len));
}

export function sectionHeader(title) {
  return color.badge(title);
}

/**
 * 带进度条地遍历文件列表，逐项执行 fn。
 * @param {Array<{path:string,label?:string}>} items
 * @param {string} label 进度条标题
 * @param {(item, index)=>void} fn 同步处理函数
 * @param {boolean} show 是否显示进度条
 */
export function runWithProgress(items, label, fn, show = true) {
  if (!show || items.length === 0) {
    items.forEach((it, i) => fn(it, i));
    return;
  }
  const bar = new cliProgress.SingleBar(
    {
      format:
        ` ${chalk.hex('#7aa2f7')(label)} |` +
        chalk.hex('#7aa2f7')('{bar}') +
        `| {percentage}% | {value}/{total} | ${chalk.dim('{file}')}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      forceRedraw: true,
    },
    cliProgress.Presets.shades_classic
  );
  bar.start(items.length, 0, { file: '' });
  try {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      bar.update(i, { file: it.label || it.path || '' });
      fn(it, i);
      bar.update(i + 1, { file: it.label || it.path || '' });
    }
  } finally {
    bar.stop();
  }
  process.stdout.write('\n');
}

/**
 * 交互式多选需要同步的语言包。
 */
export async function selectMany(choices, message, { checked = true } = {}) {
  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: chalk.cyan(message),
      choices: choices.map((c) => ({
        name: c.label ?? c.value,
        value: c.value,
        checked,
      })),
      pageSize: 15,
      validate: (v) =>
        v.length > 0 ? true : chalk.red('至少选择一项'),
    },
  ]);
  return selected;
}

/**
 * 交互式单选参考语言。
 */
export async function selectOne(choices, message) {
  const { picked } = await inquirer.prompt([
    {
      type: 'list',
      name: 'picked',
      message: chalk.cyan(message),
      choices: choices.map((c) => ({ name: c.label ?? c.value, value: c.value })),
      pageSize: 15,
    },
  ]);
  return picked;
}

export async function confirm(message, defaultValue = false) {
  const { ok } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'ok',
      message: chalk.cyan(message),
      default: defaultValue,
    },
  ]);
  return ok;
}
