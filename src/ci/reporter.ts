/**
 * ZYRA CI Reporter
 *
 * Formats deterministic CI check results for terminal display and PR Markdown comments.
 */

import { type CIResult } from './types.js';

function formatVal(val: number | null, unit: string): string {
  if (val === null || val === undefined) return 'N/A';
  if (unit === 'score') return val.toFixed(2);
  return `${Math.round(val)}ms`;
}

function formatDelta(val: number | null, unit: string): string {
  if (val === null || val === undefined) return 'N/A';
  const prefix = val > 0 ? '+' : '';
  if (unit === 'score') return `${prefix}${val.toFixed(2)}`;
  return `${prefix}${Math.round(val)}ms`;
}

function formatPct(val: number | null): string {
  if (val === null || val === undefined) return '';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

/**
 * Formats a CIResult into an aligned human-readable terminal report.
 */
export function formatCIReportTerminal(result: CIResult): string {
  const lines: string[] = [];

  lines.push('============================================================');
  lines.push(' ZYRA CI PERFORMANCE CHECK');
  lines.push('============================================================');
  lines.push(` Target:            ${result.targetUrl}`);
  lines.push(` Profile:           ${result.device}`);
  lines.push(` Run ID:            ${result.id}`);
  lines.push(` Status:            ${result.status}`);
  lines.push(` Exit Code:         ${result.exitCode}`);

  // Baseline Comparison Section
  if (result.comparison && result.comparison.compatible) {
    lines.push('');
    lines.push(' BASELINE COMPARISON');
    lines.push(' ------------------------------------------------------------');
    lines.push('  Metric          Baseline       Current        Delta          Change   Status');
    lines.push(' ------------------------------------------------------------');

    const orderedMetrics = ['lcp', 'cls', 'inp', 'fcp', 'tbt', 'speedIndex'];
    for (const key of orderedMetrics) {
      const delta = result.comparison.metrics[key];
      if (!delta) continue;

      const name = delta.name.padEnd(15);
      const baseStr = formatVal(delta.before, delta.unit).padEnd(14);
      const currStr = formatVal(delta.after, delta.unit).padEnd(14);
      const dStr = formatDelta(delta.absoluteDelta, delta.unit).padEnd(14);
      const pStr = formatPct(delta.percentageDelta).padEnd(8);
      const badge = delta.status === 'REGRESSED'
        ? '[REGRESSION]'
        : delta.status === 'IMPROVED'
        ? '[IMPROVED]'
        : '[OK]';

      lines.push(`  ${name} ${baseStr} ${currStr} ${dStr} ${pStr} ${badge}`);
    }
    lines.push(' ------------------------------------------------------------');
  } else if (result.baseline && !result.baseline.compatible) {
    lines.push('');
    lines.push(' BASELINE COMPARISON: INCOMPATIBLE');
    lines.push(`  Reason: ${result.baseline.incompatibilityReason || 'Baseline cannot be compared.'}`);
  }

  // Performance Budgets Section
  if (result.budgets.evaluations.length > 0) {
    lines.push('');
    lines.push(' PERFORMANCE BUDGETS');
    lines.push(' ------------------------------------------------------------');
    lines.push('  Metric          Actual         Budget Max     Status');
    lines.push(' ------------------------------------------------------------');

    for (const b of result.budgets.evaluations) {
      const name = b.name.padEnd(15);
      const actualStr = formatVal(b.actual, b.unit).padEnd(14);
      const maxStr = formatVal(b.budgetMax, b.unit).padEnd(14);
      const badge = b.status === 'FAIL'
        ? `[FAIL] (+${Math.round(b.delta ?? 0)}${b.unit})`
        : b.status === 'WARN'
        ? `[WARN] (above warn threshold)`
        : b.status === 'NOT_AVAILABLE'
        ? '[N/A]'
        : '[PASS]';

      lines.push(`  ${name} ${actualStr} ${maxStr} ${badge}`);
    }
    lines.push(' ------------------------------------------------------------');
  }

  lines.push('');
  lines.push(' SUMMARY');
  lines.push(' ------------------------------------------------------------');
  lines.push(`  Result:           ${result.status} (Exit Code: ${result.exitCode})`);
  lines.push(`  Details:          ${result.summary}`);
  lines.push('============================================================');

  return lines.join('\n');
}

/**
 * Formats a CIResult into a clean PR Markdown comment for GitHub Actions or GitLab CI.
 */
export function formatCIPRComment(result: CIResult): string {
  const statusEmoji = {
    PASS: '✅ PASS',
    WARN: '⚠️ WARN',
    FAIL: '❌ FAIL',
    INCONCLUSIVE: '❓ INCONCLUSIVE',
    MEASUREMENT_FAILED: '🚫 MEASUREMENT_FAILED'
  }[result.status] || result.status;

  const lines: string[] = [];

  lines.push(`### ⚡ ZYRA CI Performance Check: **${statusEmoji}** (Exit Code: \`${result.exitCode}\`)`);
  lines.push('');
  lines.push(`* **Target:** \`${result.targetUrl}\` (\`${result.device}\`)`);
  lines.push(`* **Run ID:** \`${result.id}\` | **Timestamp:** \`${result.timestamp}\``);
  lines.push(`* **Summary:** ${result.summary}`);
  lines.push('');

  // Baseline Table
  if (result.comparison && result.comparison.compatible) {
    lines.push('#### 📊 Baseline Comparison');
    lines.push('');
    lines.push('| Metric | Baseline | Current | Delta | Change | Status |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

    const orderedMetrics = ['lcp', 'cls', 'inp', 'fcp', 'tbt', 'speedIndex'];
    for (const key of orderedMetrics) {
      const delta = result.comparison.metrics[key];
      if (!delta) continue;

      const badge = delta.status === 'REGRESSED'
        ? '❌ **REGRESSION**'
        : delta.status === 'IMPROVED'
        ? '🎉 **IMPROVED**'
        : '✅ OK';

      const changeStr = delta.percentageDelta !== null ? `${delta.percentageDelta > 0 ? '+' : ''}${delta.percentageDelta.toFixed(1)}%` : '—';
      lines.push(
        `| **${delta.name}** | ${formatVal(delta.before, delta.unit)} | ${formatVal(delta.after, delta.unit)} | ${formatDelta(delta.absoluteDelta, delta.unit)} | ${changeStr} | ${badge} |`
      );
    }
    lines.push('');
  } else if (result.baseline && !result.baseline.compatible) {
    lines.push('#### ⚠️ Baseline Comparison Incompatible');
    lines.push(`*Reason:* ${result.baseline.incompatibilityReason}`);
    lines.push('');
  }

  // Performance Budgets Table
  if (result.budgets.evaluations.length > 0) {
    lines.push('#### 🎯 Performance Budgets');
    lines.push('');
    lines.push('| Metric | Actual | Budget Max | Status |');
    lines.push('| :--- | :--- | :--- | :--- |');

    for (const b of result.budgets.evaluations) {
      let statusStr = '✅ PASS';
      if (b.status === 'FAIL') {
        statusStr = `❌ **VIOLATION** (+${Math.round(b.delta ?? 0)}${b.unit})`;
      } else if (b.status === 'WARN') {
        statusStr = `⚠️ **WARNING**`;
      } else if (b.status === 'NOT_AVAILABLE') {
        statusStr = '⚪ N/A';
      }

      lines.push(`| **${b.name}** | ${formatVal(b.actual, b.unit)} | ${formatVal(b.budgetMax, b.unit)} | ${statusStr} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated deterministically by [ZYRA](https://github.com/ik7408008/zyra) Phase 09 CI Engine.*');

  return lines.join('\n');
}
