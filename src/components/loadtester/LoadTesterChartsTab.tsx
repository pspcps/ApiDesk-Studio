import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LineChart, 
  Line,
  Legend 
} from 'recharts';
import { LoadTestResult, LatencyBucket } from '../../types/loadTesting';
import { generateLatencyHistogram, generateSyntheticTimeSeries } from '../../utils/loadTestAnalytics';

interface LoadTesterChartsTabProps {
  result: LoadTestResult;
}

export const LoadTesterChartsTab: React.FC<LoadTesterChartsTabProps> = ({ result }) => {
  // 1. Percentile Curve Data
  const percentileData = [
    { name: 'p50', latency: result.latency.p50, label: 'Median' },
    { name: 'p75', latency: result.latency.p75, label: '75th %' },
    { name: 'p90', latency: result.latency.p90, label: '90th %' },
    { name: 'p97.5', latency: result.latency.p97_5, label: '97.5th %' },
    { name: 'p99', latency: result.latency.p99, label: '99th %' },
    { name: 'p99.9', latency: result.latency.p99_9, label: '99.9th %' },
    { name: 'Max', latency: result.latency.max, label: 'Peak' },
  ];

  // 2. Latency Histogram Data
  const histogramData: LatencyBucket[] = result.latencyBuckets || generateLatencyHistogram([], result);

  // 3. Time Series Dynamics Data
  const timeSeriesData = result.timeSeries || generateSyntheticTimeSeries(result);

  // 4. Status Code Data
  const statusCodeData = result.statusCodes
    ? Object.entries(result.statusCodes).map(([code, count]) => {
        let fill = '#38bdf8';
        if (code.startsWith('2')) fill = '#34d399';
        else if (code.startsWith('3')) fill = '#60a5fa';
        else if (code.startsWith('4')) fill = '#fbbf24';
        else if (code.startsWith('5')) fill = '#f87171';
        return {
          code: `HTTP ${code}`,
          count,
          fill
        };
      })
    : [];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 1. Latency Percentile Area Chart */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Latency Distribution Percentile Curve</span>
            <span className="text-[10px] text-slate-400">Response time SLA progression from median to tail max</span>
          </div>
          <span className="text-xs font-mono text-amber-400 font-bold">
            p99: {result.latency.p99}ms • Max: {result.latency.max}ms
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={percentileData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="ms" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value: any) => [`${value} ms`, 'Response Time']}
              />
              <Area 
                type="monotone" 
                dataKey="latency" 
                stroke="#f59e0b" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#latencyGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Timeline Dynamic: Throughput (RPS) & Average Latency */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Time Series Throughput &amp; Latency Dynamics</span>
            <span className="text-[10px] text-slate-400">RPS throughput and latency trends per second of test duration</span>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            Avg: {result.requestsPerSecond.toFixed(1)} req/s
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="second" stroke="#64748b" tick={{ fontSize: 11 }} unit="s" />
              <YAxis yAxisId="left" stroke="#34d399" tick={{ fontSize: 11 }} unit=" rps" />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} unit="ms" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Line yAxisId="left" type="monotone" dataKey="rps" name="Throughput (RPS)" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="avgLatency" name="Latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Latency Histogram / Response Time Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Response Time Distribution</span>
            <span className="text-[10px] text-slate-500 font-mono">Binned frequency</span>
          </div>

          <div className="h-48 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: any, name: any, item: any) => [`${value} reqs (${item.payload.percentage}%)`, 'Requests']}
                />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Status Code Breakdown Bar Chart */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">HTTP Status Code Distribution</span>
            <span className="text-[10px] text-slate-500 font-mono">RFC status response matrix</span>
          </div>

          {statusCodeData.length > 0 ? (
            <div className="h-48 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusCodeData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="code" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any) => [`${value} responses`, 'Total']}
                  />
                  <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">
              No status code data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
