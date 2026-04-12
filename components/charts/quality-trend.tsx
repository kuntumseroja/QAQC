'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface QualityTrendProps {
  data: Array<{ date: string; quality_score: number; test_coverage: number; automation_rate: number }>;
}

export default function QualityTrendChart({ data }: QualityTrendProps) {
  return (
    <div className="bg-white border border-[#e0e0e0] p-4">
      <h3 className="text-sm font-medium text-[#161616] mb-4">Quality Metrics Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6f6f6f' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6f6f6f' }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#161616', border: 'none', borderRadius: 0, fontSize: 12, color: '#f4f4f4' }}
            labelStyle={{ color: '#c6c6c6' }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="quality_score" stroke="#0f62fe" strokeWidth={2} dot={false} name="Quality Score" />
          <Line type="monotone" dataKey="test_coverage" stroke="#009d9a" strokeWidth={2} dot={false} name="Test Coverage %" />
          <Line type="monotone" dataKey="automation_rate" stroke="#8a3ffc" strokeWidth={2} dot={false} name="Automation Rate %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
