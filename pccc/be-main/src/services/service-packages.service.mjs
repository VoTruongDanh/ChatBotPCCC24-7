import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_PACKAGES_FILE = path.join(__dirname, '../../data/service-packages.json');

const DEFAULT_DATA = {
  packages: [],
  additionalServices: []
};

function normalizePackage(pkg, index) {
  return {
    id: String(pkg?.id || `package-${Date.now()}-${index}`),
    name: String(pkg?.name || '').trim(),
    price: String(pkg?.price || '').trim(),
    duration: String(pkg?.duration || '').trim(),
    features: Array.isArray(pkg?.features)
      ? pkg.features.map((feature) => String(feature).trim()).filter(Boolean)
      : [],
    color: String(pkg?.color || 'blue').trim() || 'blue',
    recommended: Boolean(pkg?.recommended)
  };
}

function normalizeAdditionalService(service, index) {
  return {
    id: String(service?.id || `service-${Date.now()}-${index}`),
    icon: String(service?.icon || '📌').trim() || '📌',
    title: String(service?.title || '').trim(),
    description: String(service?.description || '').trim(),
    price: String(service?.price || '').trim()
  };
}

function normalizeData(data) {
  const packages = Array.isArray(data?.packages)
    ? data.packages.map(normalizePackage).filter((pkg) => pkg.name)
    : [];
  const additionalServices = Array.isArray(data?.additionalServices)
    ? data.additionalServices.map(normalizeAdditionalService).filter((service) => service.title)
    : [];

  let recommendedLocked = false;
  const normalizedPackages = packages.map((pkg) => {
    if (pkg.recommended && !recommendedLocked) {
      recommendedLocked = true;
      return pkg;
    }
    return {
      ...pkg,
      recommended: false
    };
  });

  return {
    packages: normalizedPackages,
    additionalServices
  };
}

export function getServicePackagesData() {
  try {
    const data = fs.readFileSync(SERVICE_PACKAGES_FILE, 'utf-8');
    return normalizeData(JSON.parse(data));
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveServicePackagesData(data) {
  const normalized = normalizeData(data);
  fs.writeFileSync(SERVICE_PACKAGES_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
}
