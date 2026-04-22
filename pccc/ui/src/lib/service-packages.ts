export interface ServicePackage {
  id: string;
  name: string;
  price: string;
  duration: string;
  features: string[];
  color: string;
  recommended?: boolean;
}

export interface AdditionalService {
  id: string;
  icon: string;
  title: string;
  description: string;
  price: string;
}

export interface ServicePackagesResponse {
  packages: ServicePackage[];
  additionalServices: AdditionalService[];
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

export const EMPTY_SERVICE_DATA: ServicePackagesResponse = {
  packages: [],
  additionalServices: []
};

export function createEmptyPackage(): ServicePackage {
  return {
    id: `package-${Date.now()}`,
    name: '',
    price: '',
    duration: '',
    features: [''],
    color: 'blue',
    recommended: false
  };
}

export function createEmptyAdditionalService(): AdditionalService {
  return {
    id: `service-${Date.now()}`,
    icon: '📌',
    title: '',
    description: '',
    price: ''
  };
}
