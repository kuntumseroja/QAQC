'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DefectHeatmapProps {
  data: Array<{ module: string; critical: number; major: number; minor: number; cosmetic: number }>;
}

export default function DefectHeatmapChart({ data }: DefectHeatmapProps) {
  return (
    <div className="bg-white border border-[#e0e0e0] p-4">
      <h3 className="text-sm font-medium text-[#161616] mb-4">Defect Distribution by Module</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6f6f6f' }} />
          <YAxis type="category" dataKey="module" tick={{ fontSize: 11, fill: '#6f6f6f' }} width={75} />
          <Tooltip
            contentStyle={{ backgroundColor: '#161616', border: 'none', borderRadius: 0, fontSize: 12, color: '#f4f4f4' }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="critical" stackId="a" fill="#da1e28" name="Critical" />
          <Bar dataKey="major" stackId="a" fill="#ff832b" name="Major" />
          <Bar dataKey="minor" stackId="a" fill="#f1c21b" name="Minor" />
          <Bar dataKey="cosmetic" stackId="a" fill="#009d9a" name="Cosmetic" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
