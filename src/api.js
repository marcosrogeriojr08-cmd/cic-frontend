// CIC API Service Layer
// Handles all communication between front-end and back-end

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000/api/v1';

// Token management
let accessToken = null;
let refreshToken = null;
try { accessToken = localStorage.getItem('cic_token') || null; } catch(e) {}
try { refreshToken = localStorage.getItem('cic_refresh') || null; } catch(e) {}

export const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  try { if (access) localStorage.setItem('cic_token', access); } catch(e) {}
  
  try { if (refresh) localStorage.setItem('cic_refresh', refresh); } catch(e) {}
  
};

export const getToken = () => accessToken;
export const isLoggedIn = () => !!accessToken;

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  try { localStorage.removeItem('cic_token'); } catch(e) {}
  try { localStorage.removeItem('cic_refresh'); } catch(e) {}
};

// Base fetch with auth + auto refresh
const apiFetch = async (path, options = {}) => {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  // If 401 with TOKEN_EXPIRED, try refresh
  if (res.status === 401 && refreshToken) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        res = await fetch(url, { ...options, headers });
      }
    }
  }

  return res;
};

const refreshAccessToken = async () => {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (res.ok) {
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    clearTokens();
    return false;
  } catch {
    clearTokens();
    return false;
  }
};

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════

export const auth = {
  login: async (email, password) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setTokens(data.accessToken, data.refreshToken);
    }
    return { ok: res.ok, data };
  },

  register: async (name, email, password) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) setTokens(data.accessToken, data.refreshToken);
    return { ok: res.ok, data };
  },

  me: async () => {
    const res = await apiFetch('/auth/me');
    return res.ok ? await res.json() : null;
  },

  logout: () => {
    clearTokens();
  },

  forgotPassword: async (email) => {
    const res = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return res.json();
  }
};

// ═══════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════

export const campaigns = {
  list: async () => {
    const res = await apiFetch('/campaigns');
    return res.ok ? await res.json() : [];
  },

  get: async (id) => {
    const res = await apiFetch(`/campaigns/${id}`);
    return res.ok ? await res.json() : null;
  },

  create: async (data) => {
    const res = await apiFetch('/campaigns', { method: 'POST', body: JSON.stringify(data) });
    return { ok: res.ok, data: await res.json() };
  }
};

// ═══════════════════════════════════════
// GENERIC CRUD HELPER
// ═══════════════════════════════════════

const crud = (basePath) => ({
  list: async (campaignId, params = '') => {
    const res = await apiFetch(`/campaigns/${campaignId}${basePath}${params ? '?' + params : ''}`);
    return res.ok ? await res.json() : [];
  },

  get: async (campaignId, id) => {
    const res = await apiFetch(`/campaigns/${campaignId}${basePath}/${id}`);
    return res.ok ? await res.json() : null;
  },

  create: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}${basePath}`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },

  update: async (campaignId, id, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}${basePath}/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },

  patch: async (campaignId, id, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}${basePath}/${id}`, {
      method: 'PATCH', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },

  remove: async (campaignId, id) => {
    const res = await apiFetch(`/campaigns/${campaignId}${basePath}/${id}`, { method: 'DELETE' });
    return res.ok;
  }
});

// ═══════════════════════════════════════
// MODULE APIs
// ═══════════════════════════════════════

export const demandas = {
  ...crud('/demandas'),
  distribute: async (campaignId, id, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/demandas/${id}/distribute`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  comment: async (campaignId, id, content) => {
    const res = await apiFetch(`/campaigns/${campaignId}/demandas/${id}/comments`, {
      method: 'POST', body: JSON.stringify({ content })
    });
    return { ok: res.ok, data: await res.json() };
  }
};

export const diagnostico = {
  pesquisas: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/diagnostico/pesquisas`);
    return res.ok ? await res.json() : [];
  },
  swot: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/diagnostico/swot`);
    return res.ok ? await res.json() : { forca: [], fraqueza: [], oportunidade: [], ameaca: [] };
  },
  posicionamento: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/diagnostico/posicionamento`);
    return res.ok ? await res.json() : [];
  }
};

export const monitoramento = {
  redes: async (campaignId, periodo = '7d') => {
    const res = await apiFetch(`/campaigns/${campaignId}/monitoramento/redes?periodo=${periodo}`);
    return res.ok ? await res.json() : { mencoes: [], sentimentCount: [], platformCount: [] };
  },
  crises: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/monitoramento/crises`);
    return res.ok ? await res.json() : [];
  }
};

export const crm = {
  ...crud('/crm/eleitores'),
  segmentos: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/crm/segmentos`);
    return res.ok ? await res.json() : [];
  },
  scoring: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/crm/scoring`);
    return res.ok ? await res.json() : [];
  },
  interacao: async (campaignId, eleitorId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/crm/eleitores/${eleitorId}/interacoes`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  }
};

export const fundraising = {
  overview: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/fundraising/overview`);
    return res.ok ? await res.json() : {};
  },
  doadores: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/fundraising/doadores`);
    return res.ok ? await res.json() : [];
  },
  compliance: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/fundraising/compliance`);
    return res.ok ? await res.json() : { alertas: [] };
  },
  novaDoacao: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/fundraising/doacoes`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  }
};

export const comunicacao = {
  templates: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/comunicacao/templates`);
    return res.ok ? await res.json() : [];
  },
  disparos: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/comunicacao/disparos`);
    return res.ok ? await res.json() : [];
  },
  automacoes: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/comunicacao/automacoes`);
    return res.ok ? await res.json() : [];
  },
  metricas: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/comunicacao/metricas`);
    return res.ok ? await res.json() : [];
  },
  enviarDisparo: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/comunicacao/disparos`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  }
};

export const voluntarios = {
  ...crud('/voluntarios'),
  tarefas: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/voluntarios/tarefas`);
    return res.ok ? await res.json() : [];
  },
  novaTarefa: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/voluntarios/tarefas`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  moverTarefa: async (campaignId, id, status) => {
    const res = await apiFetch(`/campaigns/${campaignId}/voluntarios/tarefas/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status })
    });
    return { ok: res.ok, data: await res.json() };
  },
  campo: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/voluntarios/campo`);
    return res.ok ? await res.json() : [];
  },
  ranking: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/voluntarios/ranking`);
    return res.ok ? await res.json() : [];
  }
};

export const producao = {
  gerar: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/producao/gerar`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  gerados: async (campaignId, tipo = '', status = '') => {
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    if (status) params.set('status', status);
    const res = await apiFetch(`/campaigns/${campaignId}/producao/gerados?${params}`);
    return res.ok ? await res.json() : [];
  },
  atualizar: async (campaignId, id, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/producao/gerados/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  }
};

export const social = {
  agendar: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/social/agendar`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  agendados: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/social/agendados`);
    return res.ok ? await res.json() : [];
  }
};

export const agenda = {
  ...crud('/agenda'),
  listar: async (campaignId, inicio, fim) => {
    const params = inicio && fim ? `?inicio=${inicio}&fim=${fim}` : '';
    const res = await apiFetch(`/campaigns/${campaignId}/agenda${params}`);
    return res.ok ? await res.json() : [];
  }
};

export const debate = {
  iniciar: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/debate/iniciar`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  responder: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/debate/responder`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  historico: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/debate/historico`);
    return res.ok ? await res.json() : [];
  },
  stats: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/debate/stats`);
    return res.ok ? await res.json() : {};
  }
};

export const relatorios = {
  gerar: async (campaignId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/relatorios/gerar`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },
  historico: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/relatorios/historico`);
    return res.ok ? await res.json() : [];
  }
};

export const pesquisas = {
  ...crud('/pesquisas'),
  responder: async (campaignId, surveyId, data) => {
    const res = await apiFetch(`/campaigns/${campaignId}/pesquisas/${surveyId}/responder`, {
      method: 'POST', body: JSON.stringify(data)
    });
    return { ok: res.ok };
  }
};

export const gotv = {
  status: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/gotv/status`);
    return res.ok ? await res.json() : {};
  }
};

export const mapa = {
  regioes: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/mapa/regioes`);
    return res.ok ? await res.json() : [];
  },
  demografico: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/mapa/demografico`);
    return res.ok ? await res.json() : [];
  }
};

export const estrategia = {
  decisoes: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/estrategia/decisoes`);
    return res.ok ? await res.json() : [];
  },
  decidir: async (campaignId, id, status) => {
    const res = await apiFetch(`/campaigns/${campaignId}/estrategia/decisoes/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status })
    });
    return { ok: res.ok, data: await res.json() };
  },
  matriz: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/estrategia/matriz`);
    return res.ok ? await res.json() : [];
  },
  narrativa: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/estrategia/narrativa`);
    return res.ok ? await res.json() : null;
  },
  timeline: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/estrategia/timeline`);
    return res.ok ? await res.json() : [];
  }
};

export const ia = {
  chat: async (campaignId, message, conversaId = null) => {
    const res = await apiFetch(`/campaigns/${campaignId}/ia/chat`, {
      method: 'POST', body: JSON.stringify({ message, conversaId })
    });
    return res.ok ? await res.json() : null;
  },
  historico: async (campaignId) => {
    const res = await apiFetch(`/campaigns/${campaignId}/ia/historico`);
    return res.ok ? await res.json() : [];
  }
};

export const config = {
  me: async () => {
    const res = await apiFetch('/users/me');
    return res.ok ? await res.json() : null;
  },
  updateProfile: async (data) => {
    const res = await apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(data) });
    return { ok: res.ok, data: await res.json() };
  },
  changePassword: async (currentPassword, newPassword) => {
    const res = await apiFetch('/users/me/password', {
      method: 'PUT', body: JSON.stringify({ currentPassword, newPassword })
    });
    return { ok: res.ok, data: await res.json() };
  }
};
