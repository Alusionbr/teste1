(function () {
  'use strict';

  window.C360 = window.C360 || {};
  const { uid, nowIso } = window.C360.utils;

  const STORAGE_KEY = 'controle360_multi_v2';

  const DEFAULT_SETTINGS = {
    productTypes: [
      { value: 'materia_prima', label: 'Matéria-prima' },
      { value: 'embalagem', label: 'Embalagem / vidro / rótulo / caixa' },
      { value: 'produto_final', label: 'Produto final produzido' },
      { value: 'mercadoria', label: 'Mercadoria comprada pronta' },
      { value: 'kit', label: 'Kit / composição' },
      { value: 'servico', label: 'Serviço sem estoque físico' },
    ],
    units: ['un', 'kg', 'g', 'l', 'ml', 'pct', 'cx', 'm', 'cm'],
    businessSegments: [
      'Essências aromáticas',
      'Alimentos / marmitas',
      'Revenda de mercadorias',
      'Consignado',
      'Serviços com materiais',
      'Outro',
    ],
    channels: ['Direto', 'WhatsApp', 'Instagram', 'Site', 'Marketplace', 'Consignado', 'Outro'],
    orderStatuses: [
      { value: 'pendente', label: 'Pendente' },
      { value: 'em_preparo', label: 'Em preparo' },
      { value: 'pronto', label: 'Pronto' },
      { value: 'despachado', label: 'Despachado' },
      { value: 'concluido', label: 'Concluído' },
    ],
    taskStatuses: [
      { value: 'a_fazer', label: 'A fazer' },
      { value: 'fazendo', label: 'Fazendo' },
      { value: 'aguardando', label: 'Aguardando' },
      { value: 'feito', label: 'Feito' },
    ],
  };

  function emptyState() {
    return {
      meta: {
        schemaVersion: 2,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      activeBusinessId: null,
      settings: structuredClone(DEFAULT_SETTINGS),
      businesses: [],
      products: [],
      clients: [],
      suppliers: [],
      purchases: [],
      stockMovements: [],
      recipes: [],
      productions: [],
      sales: [],
      orders: [],
      consignments: [],
      consignmentEvents: [],
      tasks: [],
    };
  }

  function normalize(raw) {
    const base = emptyState();
    const state = { ...base, ...(raw || {}) };
    state.meta = { ...base.meta, ...(state.meta || {}) };
    state.settings = { ...base.settings, ...(state.settings || {}) };
    Object.keys(base).forEach((key) => {
      if (Array.isArray(base[key]) && !Array.isArray(state[key])) state[key] = [];
    });
    return state;
  }

  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return emptyState();
      return normalize(JSON.parse(stored));
    } catch (error) {
      console.error('Erro ao carregar estado local:', error);
      return emptyState();
    }
  }

  let state = load();

  function getState() {
    return state;
  }

  function save() {
    state.meta.updatedAt = nowIso();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function replaceState(nextState) {
    state = normalize(nextState);
    save();
  }

  function reset() {
    state = emptyState();
    localStorage.removeItem(STORAGE_KEY);
  }

  function activeBusiness() {
    return state.businesses.find((business) => business.id === state.activeBusinessId) || null;
  }

  function ensureBusiness() {
    if (!state.activeBusinessId) {
      throw new Error('Cadastre ou selecione um negócio antes de lançar dados.');
    }
  }

  function byBusiness(collectionName) {
    const businessId = state.activeBusinessId;
    if (!businessId) return [];
    return state[collectionName].filter((item) => item.businessId === businessId);
  }

  function add(collectionName, payload) {
    ensureBusiness();
    const record = {
      id: uid(collectionName),
      businessId: state.activeBusinessId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...payload,
    };
    state[collectionName].push(record);
    save();
    return record;
  }

  function addGlobal(collectionName, payload) {
    const record = {
      id: uid(collectionName),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...payload,
    };
    state[collectionName].push(record);
    save();
    return record;
  }

  function update(collectionName, id, patch) {
    const item = state[collectionName].find((record) => record.id === id);
    if (!item) throw new Error(`Registro não encontrado em ${collectionName}.`);
    Object.assign(item, patch, { updatedAt: nowIso() });
    save();
    return item;
  }

  function remove(collectionName, id) {
    const index = state[collectionName].findIndex((record) => record.id === id);
    if (index === -1) return;
    state[collectionName].splice(index, 1);
    save();
  }

  function setActiveBusiness(id) {
    state.activeBusinessId = id || null;
    save();
  }

  function recordMovement(payload) {
    ensureBusiness();
    const movement = {
      id: uid('mov'),
      businessId: state.activeBusinessId,
      createdAt: nowIso(),
      ...payload,
    };
    state.stockMovements.push(movement);
    save();
    return movement;
  }

  window.C360.state = {
    DEFAULT_SETTINGS,
    getState,
    save,
    replaceState,
    reset,
    activeBusiness,
    ensureBusiness,
    byBusiness,
    add,
    addGlobal,
    update,
    remove,
    setActiveBusiness,
    recordMovement,
  };
})();
