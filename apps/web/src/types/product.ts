export type ProductRecord = {
  id: string;
  name: string;
  price: number;
  rawCost: number;
  salePrice: number | null;
  active: boolean;
  description: string | null;
  images: Array<{
    publicId: string;
    secureUrl: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  }> | null;
};

export type ProductCreateInput = {
  name: string;
  price: number;
  rawCost: number;
  salePrice?: number | null;
  description?: string;
  active?: boolean;
  images: Array<{
    publicId: string;
    secureUrl: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  }>;
};
