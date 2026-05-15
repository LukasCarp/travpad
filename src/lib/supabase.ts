export type PinImage = {
  id: string;
  storage_path: string;
};

export type Review = {
  id: string;
  pin_id: string;
  user_id: string;
  rating: number;
  text: string | null;
  author_label: string;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  compass_text: string | null;
  compass_generated_at: string | null;
};

export type Pin = {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  description: string | null;
  services: string[];
  secret: boolean;
  details: Record<string, unknown> | null;
  lat: number;
  lng: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  images: PinImage[];
};

export type NewPin = {
  title: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  description: string | null;
  services: string[];
  secret: boolean;
  lat: number;
  lng: number;
  details: Record<string, unknown>;
  imageStoragePaths: string[];
};
