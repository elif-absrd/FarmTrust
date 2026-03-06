import React from 'react';
import { Badge } from './ui/Badge';

const statusStyles: Record<string, { backgroundColor: string; color: string }> = {
  'Pending': { backgroundColor: '#e0e0e0', color: '#666' },
  'Oracle Verifying': { backgroundColor: '#fef3c7', color: '#92400e' },
  'Smart Contract Triggered': { backgroundColor: '#dbeafe', color: '#1e40af' },
  'Payout Complete': { backgroundColor: '#dcfce7', color: '#166534' },
  'Active': { backgroundColor: '#dcfce7', color: '#166534' },
  'Expired': { backgroundColor: '#e0e0e0', color: '#666' },
};

interface StatusChipProps {
  status: string;
}

export function StatusChip({ status }: StatusChipProps) {
  const style = statusStyles[status] || statusStyles['Pending'];
  
  return (
    <Badge 
      style={{ backgroundColor: style.backgroundColor }}
      textStyle={{ color: style.color }}
    >
      {status}
    </Badge>
  );
}
