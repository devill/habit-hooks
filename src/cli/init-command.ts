import { Command } from 'commander';
import { runInit } from './init/run.js';
import { makeAutoPrompter, makeInteractivePrompter, type Prompter } from './init/prompts.js';
import { emit } from './emit.js';
import type { Language } from '../config/schema.js';

interface InitFlags {
  yes?: boolean;
  defaults?: boolean;
  dryRun?: boolean;
  acceptRecommendations?: boolean;
}

const SUPPORTED_LANGUAGES: Language[] = ['typescript', 'python'];

function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as string[]).includes(value);
}

function pickPrompter(flags: InitFlags): Prompter {
  if (flags.yes === true) return makeAutoPrompter(true);
  if (flags.defaults === true) return makeAutoPrompter(false);
  if (flags.dryRun === true) return makeAutoPrompter(false);
  return makeInteractivePrompter();
}

function rejectLanguage(language: string): void {
  emit({
    stdout: '',
    stderr: `habit-hooks: unsupported language '${language}'. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}\n`,
    exitCode: 2,
  });
}

function initOptions(prompter: Prompter, language: Language | undefined, flags: InitFlags) {
  return {
    prompter,
    dryRun: flags.dryRun === true,
    language,
    acceptRecommendations: flags.acceptRecommendations === true,
  };
}

async function execute(language: Language | undefined, flags: InitFlags): Promise<void> {
  const prompter = pickPrompter(flags);
  try {
    emit(await runInit(process.cwd(), initOptions(prompter, language, flags)));
  } finally {
    prompter.close();
  }
}

async function handleInit(language: string | undefined, flags: InitFlags): Promise<void> {
  if (language !== undefined && !isLanguage(language)) {
    rejectLanguage(language);
    return;
  }
  await execute(language, flags);
}

const ACCEPT_DESCRIPTION =
  'install missing tools and apply recommended settings to habit-hooks-owned configs';

export function registerInitCommand(program: Command): void {
  program
    .command('init [language]')
    .description('detect tools, scaffold missing configs, write a slim habit-hooks config')
    .option('--yes', 'accept every prompt (non-interactive)')
    .option('--defaults', 'take the default answer for every prompt (non-interactive)')
    .option('--dry-run', 'show what would be written without writing')
    .option('--accept-recommendations', ACCEPT_DESCRIPTION)
    .action(handleInit);
}
