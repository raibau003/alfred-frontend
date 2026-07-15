"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  ZAxis,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Treemap,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Series {
  name: string;
  dataKey: string;
  color?: string;
  type?: "bar" | "line" | "area";
}

interface RechartsPayload {
  title?: string;
  chart_type:
    | "bar"
    | "line"
    | "area"
    | "pie"
    | "scatter"
    | "radar"
    | "radialBar"
    | "composed"
    | "treemap";
  data: Array<Record<string, unknown>>;
  x_key?: string;
  y_key?: string;
  category_key?: string;
  value_key?: string;
  series?: Series[];
}

// Paleta coherente con el tema (terracota Claude + apoyos neutros/fríos/cálidos)
const PALETTE = [
  "#C96442", // terracota Claude
  "#8AA4B8", // azul apoyo
  "#7B9E89", // verde apoyo
  "#C4A35A", // dorado apoyo
  "#B0739A", // malva apoyo
  "#6E6B66", // gris apoyo
  "#A8674D", // terracota oscuro
  "#5F7E92", // azul oscuro
];

function colorOf(i: number, override?: string) {
  return override ?? PALETTE[i % PALETTE.length];
}

// Coerce a value to a finite number ("78" -> 78, "$1.234,50" -> 1234.5), else null.
function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Robustez: si el agente NO mandó `series` para bar/line/area/radar/composed, las
// derivamos de las columnas numéricas de la data (excluyendo x_key/category_key).
// Evita el "chart vacío" cuando el modelo se olvida de `series`.
function deriveSeries(
  payload: RechartsPayload,
  data: Array<Record<string, unknown>>,
  xKey: string,
): Series[] {
  if (!data.length) return [];
  const skip = new Set([xKey, payload.category_key, payload.value_key].filter(Boolean) as string[]);
  const row = data[0];
  return Object.keys(row)
    .filter((k) => !skip.has(k) && k !== "fill")
    .filter((k) => data.some((r) => toNum(r[k]) !== null))
    .map((k) => ({ name: k, dataKey: k }));
}

// Normaliza la data: coacciona a número los campos usados como valores de serie,
// para que recharts dibuje aunque vengan como string ("78").
function normalizeData(
  data: Array<Record<string, unknown>>,
  series: Series[],
): Array<Record<string, unknown>> {
  if (!series.length) return data;
  const keys = series.map((s) => s.dataKey);
  return data.map((row) => {
    const out = { ...row };
    for (const k of keys) {
      const n = toNum(row[k]);
      if (n !== null) out[k] = n;
    }
    return out;
  });
}

export function RechartsCanvas({ payload }: { payload: RechartsPayload }) {
  const rawData = payload.data ?? [];
  const xKey = payload.x_key ?? "name";
  const needsSeries = ["bar", "line", "area", "radar", "composed"].includes(payload.chart_type);
  const series =
    payload.series && payload.series.length > 0
      ? payload.series
      : needsSeries
        ? deriveSeries(payload, rawData, xKey)
        : [];
  const data = needsSeries ? normalizeData(rawData, series) : rawData;

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="border-b border-surface-4 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {payload.title ?? "Gráfico"}
        </h2>
      </div>
      <div className="min-h-[240px] flex-1 p-4">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          {renderChart(payload, data, series, xKey)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(
  payload: RechartsPayload,
  data: Array<Record<string, unknown>>,
  series: Series[],
  xKey: string,
) {
  switch (payload.chart_type) {
    case "pie": {
      const valueKey = payload.value_key ?? series[0]?.dataKey ?? "value";
      const nameKey = xKey;
      return (
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colorOf(i, series[i]?.color)} />
            ))}
          </Pie>
        </PieChart>
      );
    }

    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={colorOf(i, s.color)}
            />
          ))}
        </LineChart>
      );

    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={colorOf(i, s.color)}
              fill={colorOf(i, s.color)}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      );

    case "scatter": {
      const yKey = payload.y_key ?? "y";
      const catKey = payload.category_key;
      // Agrupar por category_key → un <Scatter> por grupo (clusters coloreados)
      const groups: { name: string; points: Array<Record<string, unknown>> }[] =
        [];
      if (catKey) {
        const byCat = new Map<string, Array<Record<string, unknown>>>();
        for (const row of data) {
          const k = String(row[catKey] ?? "—");
          if (!byCat.has(k)) byCat.set(k, []);
          byCat.get(k)!.push(row);
        }
        for (const [name, points] of byCat) groups.push({ name, points });
      } else {
        groups.push({ name: payload.title ?? "Datos", points: data });
      }
      return (
        <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} type="number" name={xKey} />
          <YAxis dataKey={yKey} type="number" name={yKey} />
          <ZAxis range={[60, 60]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Legend />
          {groups.map((g, i) => (
            <Scatter
              key={g.name}
              name={g.name}
              data={g.points}
              fill={colorOf(i)}
            />
          ))}
        </ScatterChart>
      );
    }

    case "radar":
      return (
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey={xKey} />
          <PolarRadiusAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Radar
              key={s.dataKey}
              name={s.name}
              dataKey={s.dataKey}
              stroke={colorOf(i, s.color)}
              fill={colorOf(i, s.color)}
              fillOpacity={0.3}
            />
          ))}
        </RadarChart>
      );

    case "radialBar": {
      const valueKey = payload.value_key ?? series[0]?.dataKey ?? "value";
      return (
        <RadialBarChart
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="20%"
          outerRadius="90%"
        >
          <Tooltip />
          <Legend />
          <RadialBar dataKey={valueKey} background>
            {data.map((_, i) => (
              <Cell key={i} fill={colorOf(i)} />
            ))}
          </RadialBar>
        </RadialBarChart>
      );
    }

    case "composed":
      return (
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => {
            const color = colorOf(i, s.color);
            if (s.type === "line") {
              return (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={color}
                />
              );
            }
            if (s.type === "area") {
              return (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.3}
                />
              );
            }
            return (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                fill={color}
              />
            );
          })}
        </ComposedChart>
      );

    case "treemap": {
      const valueKey = payload.value_key ?? "value";
      const coloredData = data.map((row, i) => ({
        ...row,
        fill: (row.fill as string | undefined) ?? colorOf(i),
      }));
      return (
        <Treemap
          data={coloredData}
          dataKey={valueKey}
          nameKey={xKey}
          stroke="#fff"
          isAnimationActive={false}
        >
          <Tooltip />
        </Treemap>
      );
    }

    case "bar":
    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={colorOf(i, s.color)}
            />
          ))}
        </BarChart>
      );
  }
}
