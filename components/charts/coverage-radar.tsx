'use client';

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

interface CoverageRadarProps {
  data: Array<{ dimension: string; score: number; target: number }>;
}

export default function CoverageRadarChart({ data }: CoverageRadarProps) {
  return (
    <div className="bg-white border border-[#e0e0e0] p-4">
      <h3 className="text-sm font-medium text-[#161616] mb-4">Quality Dimensions Coverage</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e0e0e0" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#525252' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#a8a8a8' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#161616', border: 'none', borderRadius: 0, fontSize: 12, color: '#f4f4f4' }}
          />
          <Radar name="Current" dataKey="score" stroke="#0f62fe" fill="#0f62fe" fillOpacity={0.2} strokeWidth={2} />
          <Radar name="Target" dataKey="target" stroke="#da1e28" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
