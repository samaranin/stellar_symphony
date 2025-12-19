export type StarRecord = {
  id: string;
  name?: string;
  bayer?: string;
  ra: number;
  dec: number;
  mag: number;
  dist?: number;
  spec?: string;
  temp?: number;
};

export type ConstellationEdge = [string, string];

export type Constellation = {
  id: string;
  name: string;
  edges: ConstellationEdge[];
};

export type StarSelection = {
  star: StarRecord;
  index: number;
};
