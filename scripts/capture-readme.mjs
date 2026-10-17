import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const dir = 'docs/assets';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:9002/', { waitUntil: 'domcontentloaded' });
  await page.getByText('DEMO TELEMETRY CONNECTED').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('heading', { name: 'OT-Sentinel' }).waitFor({ state: 'visible' });
  await page.screenshot({ path: dir + '/nexus-dashboard-normal.png', animations: 'disabled' });
  await page.getByRole('switch', { name: 'Simulate Attack' }).click();
  await page.getByText('CRITICAL THREAT DETECTED').waitFor({ state: 'visible', timeout: 20000 });
  await page.screenshot({ path: dir + '/nexus-alert.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Mark as false alarm' }).click();
  await page.getByText('CRITICAL THREAT DETECTED').waitFor({ state: 'hidden' });
  await page.screenshot({ path: dir + '/nexus-dashboard-attack.png', animations: 'disabled' });
  await page.getByRole('button', { name: /View Report/i }).click();
  await page.getByRole('heading', { name: 'Forensic Analysis Report' }).waitFor({ state: 'visible' });
  await page.screenshot({ path: dir + '/nexus-forensic-report.png', animations: 'disabled' });
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await mobile.goto('http://127.0.0.1:9002/', { waitUntil: 'domcontentloaded' });
  await mobile.getByText('DEMO TELEMETRY CONNECTED').waitFor({ state: 'visible', timeout: 30000 });
  await mobile.screenshot({ path: dir + '/nexus-dashboard-mobile.png', animations: 'disabled' });
  await mobile.close();
} finally { await browser.close(); }

let readme = await readFile('README.md', 'utf8');
const mappings = [
  ['![Dashboard in normal operation](docs/assets/dashboard-normal.png)', '![NEXUS OT-Sentinel dashboard in normal simulated operation (Chromium 1440 × 960)](docs/assets/nexus-dashboard-normal.png)'],
  ['![Alert](docs/assets/alert-rule-based.png)', '![NEXUS OT-Sentinel rule-based alert in simulation](docs/assets/nexus-alert.png)'],
  ['![Attack mode](docs/assets/dashboard-attack.png)', '![NEXUS OT-Sentinel dashboard during simulated attack](docs/assets/nexus-dashboard-attack.png)'],
];
for (const [before, after] of mappings) {
  if (readme.includes(before)) readme = readme.replace(before, after);
  else if (!readme.includes(after)) throw new Error('README screenshot anchor not found: ' + before);
}
if (!readme.includes('nexus-dashboard-mobile.png')) {
  const needle = '![NEXUS OT-Sentinel dashboard in normal simulated operation (Chromium 1440 × 960)](docs/assets/nexus-dashboard-normal.png)';
  const extra = [
    '',
    '<sub>Actual local Chromium captures of the synthetic OT stream. They do not show live PLCs, a production plant, or a validated active attack.</sub>',
    '',
    '<details><summary>Mobile NEXUS dashboard · 390 × 844</summary>',
    '',
    '<img src="docs/assets/nexus-dashboard-mobile.png" alt="NEXUS OT-Sentinel simulated telemetry mobile dashboard" width="390">',
    '',
    '</details>',
    '',
    '![NEXUS OT-Sentinel forensic report](docs/assets/nexus-forensic-report.png)',
  ].join('\n');
  if (!readme.includes(needle)) throw new Error('README normal screenshot anchor not found');
  readme = readme.replace(needle, needle + extra);
}
readme = readme.replace('Walkthrough video:', 'Earlier walkthrough video (archival recording made before the current NEXUS screenshots):');
await writeFile('README.md', readme);
console.log('Captured actual simulated OT UI: normal, alert, attack, report, mobile.');