import axios from "axios";
import { getAnonId } from "./anon";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers["X-Anon-Id"] = getAnonId();
  return config;
});

// --- Public search
export const searchApi = (q, opts = {}) =>
  api.get("/search", { params: { q, ai: opts.ai !== false, category: opts.category, limit: opts.limit || 20 } });

export const imageSearchApi = (q) => api.get("/images", { params: { q } });
export const categoriesApi = () => api.get("/categories");
export const trendingApi = () => api.get("/trending");
export const trackClickApi = (page_id, query) => api.post("/track/click", { page_id, query });

// --- User
export const getHistoryApi = () => api.get("/user/history");
export const clearHistoryApi = () => api.delete("/user/history");
export const toggleFavoriteApi = (page_id) => api.post("/user/favorites", { page_id });
export const getFavoritesApi = () => api.get("/user/favorites");
export const removeFavoriteApi = (page_id) => api.delete(`/user/favorites/${page_id}`);

// --- Admin
export const adminAddSiteApi = (url, max_pages = 30) => api.post("/admin/sites", { url, max_pages });
export const adminListSitesApi = () => api.get("/admin/sites");
export const adminDeleteSiteApi = (id) => api.delete(`/admin/sites/${id}`);
export const adminRecrawlApi = (id) => api.post(`/admin/sites/${id}/recrawl`);
export const adminStatsApi = () => api.get("/admin/stats");
