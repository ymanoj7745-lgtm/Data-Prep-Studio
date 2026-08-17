import axios from "axios";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: BASE });

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/sessions/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function impute(sid, column, strategy, value) {
  const { data } = await api.post(`/sessions/${sid}/impute`, { column, strategy, value });
  return data;
}
export async function sanitize(sid, column) {
  const { data } = await api.post(`/sessions/${sid}/sanitize`, { column });
  return data;
}
export async function cast(sid, column, target) {
  const { data } = await api.post(`/sessions/${sid}/cast`, { column, target });
  return data;
}
export async function dropColumn(sid, column) {
  const { data } = await api.post(`/sessions/${sid}/drop_column`, { column });
  return data;
}
export async function renameColumn(sid, column, new_name) {
  const { data } = await api.post(`/sessions/${sid}/rename_column`, { column, new_name });
  return data;
}
export async function dropDuplicates(sid) {
  const { data } = await api.post(`/sessions/${sid}/drop_duplicates`);
  return data;
}
export async function stripWhitespace(sid, column) {
  const { data } = await api.post(`/sessions/${sid}/strip_whitespace`, { column });
  return data;
}
export async function fetchChart(sid, columns) {
  const { data } = await api.post(`/sessions/${sid}/chart`, { columns });
  return data;
}
export function scriptUrl(sid) {
  return `${BASE}/sessions/${sid}/script`;
}
export function csvUrl(sid) {
  return `${BASE}/sessions/${sid}/download_csv`;
}
