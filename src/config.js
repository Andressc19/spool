// ═════════════════════════════════════════════════════════════════════
// Spool - Config
// ═════════════════════════════════════════════════════════════

const API = "/backend-api";
const PAGE_SIZE = 100;
const DELAY = 500;
const STORAGE_KEY = "spool_selections";
const STORAGE_EXPANDED_KEY = "spool_expanded";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));