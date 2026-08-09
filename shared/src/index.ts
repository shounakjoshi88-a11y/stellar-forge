export const API_BASE_URL = "http://localhost:3001/api";

export interface ApiResponse<T> {
  data: T;
  error?: string;
}
