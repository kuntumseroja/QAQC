'use client';

interface Service {
  id: string;
  name: string;
  domain: string;
  status: string;
  requests_total: number;
  avg_response_ms: number;
}

interface ServiceHealthProps {
  services: Service[];
}

const domainColors: Record<string, string> = {
  application: '#0f62fe',
  'data-analytics': '#009d9a',
  infrastructure: '#8a3ffc',
  defects: '#da1e28',
};

const statusColors: Record<string, string> = {
  healthy: '#198038',
  degraded: '#f1c21b',
  down: '#da1e28',
};

export default function ServiceHealthGrid({ services }: ServiceHealthProps) {
  return (
    <div className="bg-white border border-[#e0e0e0] p-4">
      <h3 className="text-sm font-medium text-[#161616] mb-4">Service Health Status</h3>
      <div className="grid grid-cols-4 gap-2">
        {services.map((svc) => (
          <div
            key={svc.id}
            className="p-2 border border-[#e0e0e0] hover:border-[#0f62fe] transition-colors cursor-pointer"
            title={`${svc.name}\nStatus: ${svc.status}\nRequests: ${svc.requests_total}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[svc.status] || '#8d8d8d' }} />
              <span className="text-[10px] font-medium text-[#161616] truncate">{svc.id}</span>
            </div>
            <div className="text-[10px] text-[#6f6f6f] truncate">{svc.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: (domainColors[svc.domain] || '#8d8d8d') + '1a', color: domainColors[svc.domain] }}>
                {svc.domain}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
