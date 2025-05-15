export interface QueryInput {
  franchise_name: string;
  city: string;
  state: string;
  country: string;
}

export type FranchiseQuery = QueryInput;

export interface LocationDetails {
  Address: string;
  Phone: string;
  Source: string;
}

export interface FranchiseLocation {
  address: string;
  phoneNumber: string;
  source: string;
}

export interface SourceProgress {
  source: string;
  status: 'initializing' | 'searching' | 'complete' | 'error';
  message?: string;
  count: number;
}

export interface SourcedLocation extends FranchiseLocation {
  source: string;
}

export interface QueryResponse {
  status: string;
  data: {
    locations: LocationDetails[];
  };
}

export interface FranchiseResponse {
  status: string;
  data: {
    locations: LocationDetails[];
  };
}

export interface SearchHistoryItem extends FranchiseQuery {
  id: string;
  timestamp: number;
}

export interface StreamingEvent {
  type: 'location' | 'complete' | 'error';
  data?: LocationDetails;
  error?: string;
}