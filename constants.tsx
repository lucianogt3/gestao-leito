
import React from 'react';
import { BedStatus } from './types';

export const STATUS_CONFIG: Record<BedStatus, { 
  label: string, 
  color: string, 
  bg: string, 
  border: string,
  icon: React.ReactNode 
}> = {
  [BedStatus.LIVRE]: { 
    label: 'Livre', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-50', 
    border: 'border-emerald-200',
    icon: <i className="fa-solid fa-check-circle"></i>
  },
  [BedStatus.OCUPADO]: { 
    label: 'Ocupado', 
    color: 'text-rose-700', 
    bg: 'bg-rose-50', 
    border: 'border-rose-200',
    icon: <i className="fa-solid fa-user-injured"></i>
  },
  [BedStatus.HIGIENIZACAO]: { 
    label: 'Higienização', 
    color: 'text-amber-700', 
    bg: 'bg-amber-50', 
    border: 'border-amber-200',
    icon: <i className="fa-solid fa-soap"></i>
  },
  [BedStatus.BLOQUEADO]: { 
    label: 'Bloqueado', 
    color: 'text-gray-700', 
    bg: 'bg-gray-100', 
    border: 'border-gray-300',
    icon: <i className="fa-solid fa-ban"></i>
  },
  [BedStatus.RESERVADO]: { 
    label: 'Reservado', 
    color: 'text-blue-700', 
    bg: 'bg-blue-50', 
    border: 'border-blue-200',
    icon: <i className="fa-solid fa-clock"></i>
  }
};
