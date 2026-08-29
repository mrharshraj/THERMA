// Curated Miami-Dade asset seed list. Asset heat values are DERIVED from the
// fetched heat layer at analysis time — the list itself is only geospatial
// context, not fabricated temperature data.

const assets = [
  { id: 'asset-jackson-memorial', name: 'Jackson Memorial Hospital', type: 'Hospital', category: 'healthcare', lat: 25.7907, lon: -80.2095 },
  { id: 'asset-baptist-miami', name: 'Baptist Hospital of Miami', type: 'Hospital', category: 'healthcare', lat: 25.6389, lon: -80.3076 },
  { id: 'asset-umh-nicu', name: 'UM Health Center', type: 'Clinic', category: 'healthcare', lat: 25.7929, lon: -80.2097 },
  { id: 'asset-mdcps-central', name: 'M-DCPS Central Office', type: 'School District', category: 'education', lat: 25.7743, lon: -80.2096 },
  { id: 'asset-fiu', name: 'Florida International University', type: 'University', category: 'education', lat: 25.7573, lon: -80.3736 },
  { id: 'asset-mdc-campus', name: 'Miami Dade College Wolfson', type: 'College', category: 'education', lat: 25.7817, lon: -80.1873 },
  { id: 'asset-substation-alpha', name: 'Grid Substation Alpha', type: 'Substation', category: 'energy', lat: 25.7732, lon: -80.1902 },
  { id: 'asset-substation-brickell', name: 'Brickell Power Hub', type: 'Substation', category: 'energy', lat: 25.7602, lon: -80.1955 },
  { id: 'asset-solar-wynwood', name: 'Wynwood Solar Array', type: 'Solar', category: 'energy', lat: 25.8023, lon: -80.1958 },
  { id: 'asset-port-miami', name: 'PortMiami', type: 'Port', category: 'logistics', lat: 25.7725, lon: -80.1598 },
  { id: 'asset-miami-dade-transit', name: 'Metrorail Central Ops', type: 'Transit Depot', category: 'transport', lat: 25.7762, lon: -80.1865 },
  { id: 'asset-mia-cargo', name: 'MIA Cargo Center', type: 'Air Cargo', category: 'logistics', lat: 25.7957, lon: -80.2815 },
  { id: 'asset-water-pump-1', name: 'Hialeah Water Pumping', type: 'Water Plant', category: 'water', lat: 25.8489, lon: -80.2864 },
  { id: 'asset-water-south', name: 'South Miami Wastewater', type: 'Water Plant', category: 'water', lat: 25.6665, lon: -80.2989 },
  { id: 'asset-bayside-park', name: 'Bayside Park', type: 'Park', category: 'parks', lat: 25.7802, lon: -80.1854 },
  { id: 'asset-panther-park', name: 'Marlins Park District', type: 'Recreation', category: 'parks', lat: 25.7782, lon: -80.2196 },
  { id: 'asset-lynch-park', name: 'Lynch Park', type: 'Park', category: 'parks', lat: 25.8058, lon: -80.2108 },
  { id: 'asset-telco-edgewater', name: 'Edgewater Telecom Hub', type: 'Communications', category: 'communications', lat: 25.7935, lon: -80.1887 },
  { id: 'asset-telco-doral', name: 'Doral Data Center', type: 'Data Center', category: 'communications', lat: 25.8245, lon: -80.3401 },
  { id: 'asset-cool-warehouse', name: 'Allapattah Cold Chain', type: 'Cold Storage', category: 'logistics', lat: 25.8147, lon: -80.2205 },
  { id: 'asset-downtown-schools', name: 'Downtown School District', type: 'School Cluster', category: 'education', lat: 25.7763, lon: -80.2004 },
  { id: 'asset-lifeboat-center', name: 'Miami Coast Guard Station', type: 'Emergency', category: 'healthcare', lat: 25.7704, lon: -80.1712 },
  { id: 'asset-omni-district', name: 'Omni Transit Hub', type: 'Transit Hub', category: 'transport', lat: 25.7840, lon: -80.1924 },
  { id: 'asset-convention-center', name: 'Miami Beach Convention Center', type: 'Public Venue', category: 'commercial', lat: 25.7935, lon: -80.1343 },
  { id: 'asset-adrienne-arsht', name: 'Adrienne Arsht Center', type: 'Public Venue', category: 'commercial', lat: 25.7898, lon: -80.1927 },
];

const categories = {
  healthcare: { label: 'Healthcare', color: '#b91c1c', icon: 'local_hospital' },
  education: { label: 'Education', color: '#f97316', icon: 'school' },
  energy: { label: 'Energy', color: '#f59e0b', icon: 'bolt' },
  transport: { label: 'Transport', color: '#0b57d0', icon: 'directions_bus' },
  water: { label: 'Water', color: '#2b7de9', icon: 'water_drop' },
  parks: { label: 'Parks & Recreation', color: '#16a34a', icon: 'park' },
  communications: { label: 'Communications', color: '#7c3aed', icon: 'cell_tower' },
  logistics: { label: 'Logistics', color: '#0d9488', icon: 'inventory_2' },
  commercial: { label: 'Commercial', color: '#4b5563', icon: 'storefront' },
};

module.exports = { assets, categories };