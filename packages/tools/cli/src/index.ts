#!/usr/bin/env node

type CLICommand = 'help' | 'optimize-target' | 'benchmark' | 'deploy';

interface BenchmarkReport {
  device: string;
  timestamp: string;
  simulatedFPS: number;
  trackingBudgetMs: number;
  renderBudgetMs: number;
}

const [, , rawCommand = 'help', ...args] = process.argv;
const command = rawCommand as CLICommand;

function help(): void {
  console.log(`aetherar commands:
  optimize-target <image-path>
  benchmark --device <name>
  deploy --target <provider>`);
}

function readFlag(flag: string): string | undefined {
  const index = args.findIndex((arg) => arg === flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function runBenchmark(device: string): BenchmarkReport {
  const normalized = device.toLowerCase();
  const profile = normalized.includes('iphone') ? 58 : normalized.includes('pixel') ? 52 : 45;

  return {
    device,
    timestamp: new Date().toISOString(),
    simulatedFPS: profile,
    trackingBudgetMs: Number((1000 / Math.min(profile, 30)).toFixed(2)),
    renderBudgetMs: Number((1000 / profile).toFixed(2))
  };
}

switch (command) {
  case 'optimize-target': {
    const imagePath = args[0];
    if (!imagePath) {
      console.error('Missing image path.');
      process.exitCode = 1;
      break;
    }

    console.log(JSON.stringify({
      command,
      imagePath,
      status: 'optimized',
      output: `${imagePath}.aether.target`
    }));
    break;
  }
  case 'benchmark': {
    const device = readFlag('--device') ?? 'generic-mobile';
    const report = runBenchmark(device);
    console.log(JSON.stringify(report));
    break;
  }
  case 'deploy': {
    const target = readFlag('--target');
    if (!target) {
      console.error('Missing --target provider.');
      process.exitCode = 1;
      break;
    }

    console.log(JSON.stringify({
      command,
      target,
      status: 'queued'
    }));
    break;
  }
  default:
    help();
}
