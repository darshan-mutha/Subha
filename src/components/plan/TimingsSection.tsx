"use client";

import type { DayTimings } from "@/lib/muhurat";

/** Rahu Kalam and the other periods to avoid, plus better windows in the day. */
export function TimingsSection({ timings }: { timings: DayTimings }) {
  const rows: [string, { start: string; end: string }][] = [
    ["Rahu Kalam", timings.rahuKalam],
    ["Yamagandam", timings.yamagandam],
    ["Gulika Kalam", timings.gulikaKalam],
  ];
  return (
    <>
      <h2 className="section-title">Auspicious timings</h2>
      <p>
        {timings.weekday}, {timings.date} in {timings.location}. Sunrise {timings.sunrise}, sunset {timings.sunset}.
      </p>
      <div className="table-wrap">
        <table className="budget-table">
          <caption className="sr-only">Periods traditionally avoided for starting ceremonies</caption>
          <thead>
            <tr>
              <th scope="col">Period to avoid</th>
              <th scope="col">From</th>
              <th scope="col">To</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, range]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{range.start}</td>
                <td>{range.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Better windows during the day</h3>
      <ul className="list">
        {timings.betterWindows.map((w) => (
          <li key={w.start}>
            {w.start} – {w.end}
          </li>
        ))}
      </ul>
      <p className="note">
        Calculated from local sunrise and sunset. Please confirm the exact muhurat with your family priest or a
        panchang.
      </p>
    </>
  );
}
