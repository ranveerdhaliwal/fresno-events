export interface AdminLocationPickerProps {
  token: string;
  lat: string;
  lng: string;
  address: string;
  city: string;
  onChange: (coords: { lat: string; lng: string }) => void;
}
