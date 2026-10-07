import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DETECTOR_LABELS,
  SET_TITLES,
  baseRate,
  decisionRows,
  explanationRows,
  fixed,
  pct,
  perAttackRows,
  results,
  summaryRows,
  type Evaluation,
} from '@/lib/case-study';

export const metadata: Metadata = {
  title: 'Case study · OT-Sentinel',
  description: 'Offline evaluation of the anomaly-detection method on the public BATADAL benchmark.',
};

const CASE_STUDY_URL = 'https://github.com/senanurcetin/ot-sentinel/blob/main/docs/case-study.md';

function SummaryTable({ evaluation }: { evaluation: Evaluation }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Detector</TableHead>
          <TableHead className="text-right">Attacks caught</TableHead>
          <TableHead className="text-right">Expected from false alarms alone</TableHead>
          <TableHead className="text-right">Median hours to detect</TableHead>
          <TableHead className="text-right">Alarm hours in attack-free data</TableHead>
          <TableHead className="text-right">Precision</TableHead>
          <TableHead className="text-right">Attack hours caught</TableHead>
          <TableHead className="text-right">PR-AUC</TableHead>
          <TableHead className="text-right">PR-AUC 95 % interval</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summaryRows(evaluation).map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right">{row.caught}</TableCell>
            <TableCell className="text-right">{row.expectedByChance}</TableCell>
            <TableCell className="text-right">{row.medianHours}</TableCell>
            <TableCell className="text-right">{row.alarmHoursNormal}</TableCell>
            <TableCell className="text-right">{row.precision}</TableCell>
            <TableCell className="text-right">{row.attackHoursCaught}</TableCell>
            <TableCell className="text-right">{row.prAuc}</TableCell>
            <TableCell className="text-right">{row.prAucInterval}</TableCell>
          </TableRow>
        ))}
        {(evaluation.not_evaluated ?? []).map((key) => (
          <TableRow key={key}>
            <TableCell className="font-medium">{DETECTOR_LABELS[key] ?? key}</TableCell>
            <TableCell colSpan={8} className="text-muted-foreground">
              not evaluated here: trained on this data
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PerAttackTable({ evaluation }: { evaluation: Evaluation }) {
  const { columns, rows } = perAttackRows(evaluation);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Attack</TableHead>
          <TableHead className="text-right">Duration (h)</TableHead>
          {columns.map((c) => (
            <TableHead key={c} className="text-right">
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.attack}>
            <TableCell className="font-medium">{row.attack}</TableCell>
            <TableCell className="text-right">{row.durationHours}</TableCell>
            {row.cells.map((cell, i) => (
              <TableCell key={i} className="text-right">
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DecisionCard() {
  const rows = decisionRows(results);
  if (rows.length === 0) return null;
  const reference = (DETECTOR_LABELS[results.decision!.reference] ?? '').toLowerCase();
  const passed = rows.filter((r) => r.better);
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Does adding time help? (protocol v3)
        </h2>
        <CardDescription>
          Rule fixed before the run: a temporal detector beats the {reference} only if the 95 %
          interval of its paired PR-AUC difference on the test file lies entirely above 0.{' '}
          {passed.length === 0
            ? 'No temporal detector passes.'
            : `Passes: ${passed.map((r) => r.label).join(', ')}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Detector</TableHead>
              <TableHead className="text-right">PR-AUC minus {reference}, 95 % interval</TableHead>
              <TableHead className="text-right">Better?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right">{row.difference}</TableCell>
                <TableCell className="text-right">{row.better ? 'yes' : 'no'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExplanationCard() {
  const sets = ['test', 'train'] as const;
  if (explanationRows(results.evaluations.test).length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Do the explanations point at the attacked equipment?
        </h2>
        <CardDescription>
          Share of alarmed attack hours whose three strongest signals include one the attack
          description names, next to the chance level. Attacks that replay normal readings hide
          exactly those signals, so a miss there does not mean the alarm is spurious.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 overflow-x-auto">
        {sets.map((name) => (
          <div key={name}>
            <h3 className="mb-2 text-sm font-medium">{SET_TITLES[name]}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Detector</TableHead>
                  <TableHead className="text-right">Alarmed attack hours</TableHead>
                  <TableHead className="text-right">Top 3 include an attacked signal</TableHead>
                  <TableHead className="text-right">Chance level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {explanationRows(results.evaluations[name]).map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">{row.alarmedHours}</TableCell>
                    <TableCell className="text-right">{row.hitRate}</TableCell>
                    <TableCell className="text-right">{row.chance}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function CaseStudyPage() {
  const sets = ['test', 'train'] as const;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Detector evaluation on BATADAL</h1>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <Card role="note" aria-label="How to read these results">
        <CardHeader>
          <h2 className="text-base font-semibold leading-none tracking-tight">Read this first</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This is an <strong>offline</strong> evaluation of the detection <em>method</em> on all{' '}
            {results.data.n_features} BATADAL signals. The dashboard&apos;s live scorer is a 3-signal
            demo and is <strong>not</strong> what was measured.
          </p>
          <p>
            Every detector catches every attack, but false alarms alone would be expected to land in
            almost all of them, and one detector (CUSUM) alarms most of the time, so &quot;attacks
            caught&quot; says little. The hour-level columns (precision, attack hours caught, PR-AUC
            against the random-guess level) carry the information, and they are modest. With{' '}
            {results.evaluations.test.attacks} attacks per file, differences between detectors are
            anecdotes, and the 95 % intervals overlap.
          </p>
          <p>
            Three detectors marked (v3) add time to the per-hour z-score. They were fixed in advance
            with a decision rule, and by that rule none of them improves on the z-score on the test
            file.
          </p>
          <p>
            Protocol: thresholds come from attack-free data only, with the same false-alarm budget (
            {results.protocol.max_false_alarms_per_day} alarm segment per day) for every detector.
            Full write-up, including a correction I made to my own metric after a first run:{' '}
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={CASE_STUDY_URL}
              rel="noreferrer"
            >
              docs/case-study.md
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {sets.map((name) => {
        const evaluation = results.evaluations[name];
        return (
          <section key={name} aria-labelledby={`${name}-title`} className="space-y-4">
            <Card>
              <CardHeader>
                <h2 id={`${name}-title`} className="text-lg font-semibold leading-none tracking-tight">
                  {SET_TITLES[name]}
                </h2>
                <CardDescription>
                  {evaluation.attacks} attacks, {evaluation.attack_hours} attack hours (
                  {pct(baseRate(evaluation))} of {evaluation.attack_hours + evaluation.attack_free_hours});
                  a random guess scores a PR-AUC of about {fixed(baseRate(evaluation))}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 overflow-x-auto">
                <SummaryTable evaluation={evaluation} />
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    Hours from the published attack start to the first alarm
                  </h3>
                  <PerAttackTable evaluation={evaluation} />
                </div>
              </CardContent>
            </Card>
          </section>
        );
      })}

      <DecisionCard />

      <ExplanationCard />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold leading-none tracking-tight">Data drift</h2>
          <CardDescription>
            Share of attack-free evaluation hours with a feature outside the min-max range of the
            2014 reference (descriptive; nothing was adjusted for it).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evaluation file</TableHead>
                <TableHead className="text-right">Attack-free hours</TableHead>
                <TableHead className="text-right">Hours with any feature outside range</TableHead>
                <TableHead>Features most often outside range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sets.map((name) => {
                const d = results.drift[name];
                return (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{d.normal_hours}</TableCell>
                    <TableCell className="text-right">
                      {pct(d.share_of_hours_with_any_feature_outside_reference_range)}
                    </TableCell>
                    <TableCell>
                      {Object.entries(d.top_features_share_of_hours_outside_reference_range)
                        .map(([feature, share]) => `${feature} (${pct(share)})`)
                        .join(', ')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold leading-none tracking-tight">Limitations</h2>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {results.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            † trained on dataset04 with the published attack intervals and evaluated on the test set
            only; an optimistic reference, not a deployable detector.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
